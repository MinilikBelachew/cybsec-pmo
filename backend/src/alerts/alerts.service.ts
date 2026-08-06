import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { isAlertEscalationRole } from './alert-roles.constants';
import {
  AcknowledgeAlertEventDto,
  AlertEventDto,
  AlertRuleDto,
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
} from './dto/alert.dto';

type RuleRow = Prisma.AlertRuleGetPayload<{
  include: {
    recipients: {
      include: { role: { select: { id: true; code: true; label: true } } };
    };
  };
}>;

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalogue(): Promise<AlertRuleDto[]> {
    const rows = await this.prisma.alertRule.findMany({
      include: {
        recipients: {
          include: { role: { select: { id: true, code: true, label: true } } },
        },
      },
      orderBy: [{ isActive: 'desc' }, { eventType: 'asc' }],
    });
    return rows.map((row) => this.toRuleDto(row));
  }

  async createRule(dto: CreateAlertRuleDto): Promise<AlertRuleDto> {
    if (!dto.channels?.length) {
      throw new BadRequestException('At least one channel is required');
    }
    if (!dto.recipientRoleIds?.length) {
      throw new BadRequestException('At least one recipient role is required');
    }
    this.assertEscalationRole(dto.escalationRole);
    await this.assertRolesExist(dto.recipientRoleIds);

    const created = await this.prisma.alertRule.create({
      data: {
        eventType: dto.eventType.trim(),
        thresholdConfig: dto.thresholdConfig as Prisma.InputJsonValue,
        channels: dto.channels,
        reminderCadenceHrs: dto.reminderCadenceHrs ?? 24,
        escalationDelayHrs: dto.escalationDelayHrs ?? 48,
        escalationRole: dto.escalationRole.trim(),
        isActive: dto.isActive ?? true,
        recipients: dto.recipientRoleIds?.length
          ? {
              create: dto.recipientRoleIds.map((roleId) => ({ roleId })),
            }
          : undefined,
      },
      include: {
        recipients: {
          include: { role: { select: { id: true, code: true, label: true } } },
        },
      },
    });
    return this.toRuleDto(created);
  }

  async updateRule(ruleId: string, dto: UpdateAlertRuleDto): Promise<AlertRuleDto> {
    const existing = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }

    if (dto.escalationRole !== undefined) {
      this.assertEscalationRole(dto.escalationRole);
    }
    if (dto.recipientRoleIds) {
      if (dto.recipientRoleIds.length === 0) {
        throw new BadRequestException('At least one recipient role is required');
      }
      await this.assertRolesExist(dto.recipientRoleIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.recipientRoleIds) {
        await tx.alertRuleRecipient.deleteMany({ where: { ruleId } });
        if (dto.recipientRoleIds.length > 0) {
          await tx.alertRuleRecipient.createMany({
            data: dto.recipientRoleIds.map((roleId) => ({ ruleId, roleId })),
          });
        }
      }

      return tx.alertRule.update({
        where: { id: ruleId },
        data: {
          ...(dto.eventType !== undefined
            ? { eventType: dto.eventType.trim() }
            : {}),
          ...(dto.thresholdConfig !== undefined
            ? {
                thresholdConfig: dto.thresholdConfig as Prisma.InputJsonValue,
              }
            : {}),
          ...(dto.channels !== undefined ? { channels: dto.channels } : {}),
          ...(dto.reminderCadenceHrs !== undefined
            ? { reminderCadenceHrs: dto.reminderCadenceHrs }
            : {}),
          ...(dto.escalationDelayHrs !== undefined
            ? { escalationDelayHrs: dto.escalationDelayHrs }
            : {}),
          ...(dto.escalationRole !== undefined
            ? { escalationRole: dto.escalationRole.trim() }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          recipients: {
            include: {
              role: { select: { id: true, code: true, label: true } },
            },
          },
        },
      });
    });

    return this.toRuleDto(updated);
  }

  async disableRule(ruleId: string): Promise<void> {
    const existing = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }
    await this.prisma.alertRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }

  /** Permanently remove a catalogue rule and its events / recipients. */
  async deleteRule(ruleId: string): Promise<void> {
    const existing = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.alertEvent.deleteMany({ where: { ruleId } });
      await tx.alertRuleRecipient.deleteMany({ where: { ruleId } });
      await tx.alertRule.delete({ where: { id: ruleId } });
    });
  }

  async listInstances(filters?: {
    ruleId?: string;
  }): Promise<AlertEventDto[]> {
    const rows = await this.prisma.alertEvent.findMany({
      where: {
        ...(filters?.ruleId ? { ruleId: filters.ruleId } : {}),
      },
      include: {
        rule: { select: { eventType: true } },
      },
      orderBy: { firedAt: 'desc' },
      take: 200,
    });

    const titleByKey = await this.resolveObjectTitles(rows);

    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      eventType: row.rule.eventType,
      objectType: row.objectType,
      objectId: row.objectId,
      objectTitle: row.objectId
        ? (titleByKey.get(`${row.objectType}:${row.objectId}`) ?? null)
        : null,
      channel: row.channel,
      deliveryStatus: row.deliveryStatus,
      acknowledgedBy: row.acknowledgedBy,
      escalationLevel: row.escalationLevel,
      firedAt: row.firedAt.toISOString(),
      ackedAt: row.ackedAt?.toISOString() ?? null,
      nextReminderAt: row.nextReminderAt?.toISOString() ?? null,
    }));
  }

  async acknowledge(
    eventId: string,
    actorId: string,
    _dto: AcknowledgeAlertEventDto,
  ): Promise<AlertEventDto> {
    const existing = await this.prisma.alertEvent.findUnique({
      where: { id: eventId },
      include: { rule: { select: { eventType: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Alert instance not found');
    }

    const updated = await this.prisma.alertEvent.update({
      where: { id: eventId },
      data: {
        acknowledgedBy: actorId,
        ackedAt: new Date(),
        nextReminderAt: null,
        deliveryStatus: 'acknowledged',
      },
      include: { rule: { select: { eventType: true } } },
    });

    const titleByKey = await this.resolveObjectTitles([updated]);

    return {
      id: updated.id,
      ruleId: updated.ruleId,
      eventType: updated.rule.eventType,
      objectType: updated.objectType,
      objectId: updated.objectId,
      objectTitle: updated.objectId
        ? (titleByKey.get(`${updated.objectType}:${updated.objectId}`) ?? null)
        : null,
      channel: updated.channel,
      deliveryStatus: updated.deliveryStatus,
      acknowledgedBy: updated.acknowledgedBy,
      escalationLevel: updated.escalationLevel,
      firedAt: updated.firedAt.toISOString(),
      ackedAt: updated.ackedAt?.toISOString() ?? null,
      nextReminderAt: updated.nextReminderAt?.toISOString() ?? null,
    };
  }

  private async resolveObjectTitles(
    rows: Array<{ objectType: string; objectId: string | null }>,
  ): Promise<Map<string, string>> {
    const riskIds = new Set<string>();
    const issueIds = new Set<string>();
    for (const row of rows) {
      if (!row.objectId) continue;
      if (row.objectType === 'Risk') riskIds.add(row.objectId);
      if (row.objectType === 'Issue') issueIds.add(row.objectId);
    }

    const map = new Map<string, string>();
    if (riskIds.size > 0) {
      const risks = await this.prisma.risk.findMany({
        where: { id: { in: Array.from(riskIds) } },
        select: { id: true, title: true },
      });
      for (const risk of risks) {
        map.set(`Risk:${risk.id}`, risk.title);
      }
    }
    if (issueIds.size > 0) {
      const issues = await this.prisma.issue.findMany({
        where: { id: { in: Array.from(issueIds) } },
        select: { id: true, title: true },
      });
      for (const issue of issues) {
        map.set(`Issue:${issue.id}`, issue.title);
      }
    }
    return map;
  }

  private assertEscalationRole(roleCode: string): void {
    if (!isAlertEscalationRole(roleCode.trim())) {
      throw new BadRequestException(
        'Escalation role must be pm, pmo_lead, team_lead, super_admin, or it_admin',
      );
    }
  }

  private async assertRolesExist(roleIds: number[]): Promise<void> {
    if (!roleIds.length) return;
    const count = await this.prisma.role.count({
      where: { id: { in: roleIds } },
    });
    if (count !== roleIds.length) {
      throw new BadRequestException('One or more recipient roles were not found');
    }
  }

  private toRuleDto(row: RuleRow): AlertRuleDto {
    return {
      id: row.id,
      eventType: row.eventType,
      thresholdConfig: (row.thresholdConfig ?? {}) as Record<string, unknown>,
      channels: row.channels,
      reminderCadenceHrs: row.reminderCadenceHrs,
      escalationDelayHrs: row.escalationDelayHrs,
      escalationRole: row.escalationRole,
      isActive: row.isActive,
      recipients: row.recipients.map((r) => ({
        id: r.id,
        roleId: r.roleId,
        roleCode: r.role.code,
        roleName: r.role.label,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
