import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
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
    await this.assertRolesExist(dto.recipientRoleIds ?? []);

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

    if (dto.recipientRoleIds) {
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
    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      eventType: row.rule.eventType,
      objectType: row.objectType,
      objectId: row.objectId,
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

    return {
      id: updated.id,
      ruleId: updated.ruleId,
      eventType: updated.rule.eventType,
      objectType: updated.objectType,
      objectId: updated.objectId,
      channel: updated.channel,
      deliveryStatus: updated.deliveryStatus,
      acknowledgedBy: updated.acknowledgedBy,
      escalationLevel: updated.escalationLevel,
      firedAt: updated.firedAt.toISOString(),
      ackedAt: updated.ackedAt?.toISOString() ?? null,
      nextReminderAt: updated.nextReminderAt?.toISOString() ?? null,
    };
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
