import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { RoleEnum } from '../roles/roles.enum';
import {
  AddEscalationCommunicationDto,
  CloseEscalationDto,
  CreateEscalationDto,
  EscalationDto,
} from './dto/escalation.dto';

const CLOSED_STATUSES = new Set(['Closed', 'Resolved', 'Cancelled']);
const MANAGEMENT_ROLES = [
  RoleEnum.pmo_lead,
  RoleEnum.super_admin,
  RoleEnum.pm,
];

/** Engineers only see escalations they own; they cannot create. */
const ESCALATION_ASSIGNEE_ROLES = new Set<string>([RoleEnum.engineer]);

type EscalationRow = Prisma.CustomerEscalationGetPayload<{
  include: {
    owner: { select: { id: true; displayName: true; email: true } };
    customer: { select: { id: true; displayName: true } };
    communications: {
      include: {
        logger: { select: { id: true; displayName: true; email: true } };
      };
      orderBy: { createdAt: 'desc' };
    };
  };
}>;

function isOverdue(createdAt: Date, slaTargetHrs: number, status: string): boolean {
  if (CLOSED_STATUSES.has(status)) return false;
  const deadline = createdAt.getTime() + slaTargetHrs * 60 * 60 * 1000;
  return Date.now() > deadline;
}

@Injectable()
export class EscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private isAssigneeOnlyRole(roleCode?: string | null): boolean {
    return Boolean(roleCode && ESCALATION_ASSIGNEE_ROLES.has(roleCode));
  }

  async list(
    caslUser: CaslUserContext,
    filters?: { customerId?: string; status?: string; severity?: string },
  ): Promise<EscalationDto[]> {
    const rows = await this.prisma.customerEscalation.findMany({
      where: {
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.severity ? { severity: filters.severity } : {}),
        ...(this.isAssigneeOnlyRole(caslUser.roleCode)
          ? { ownerId: caslUser.id }
          : {}),
      },
      include: this.include(),
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    dto: CreateEscalationDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<EscalationDto> {
    if (this.isAssigneeOnlyRole(caslUser.roleCode)) {
      throw new ForbiddenException(
        'You do not have permission to create escalations',
      );
    }

    await this.assertOwnerExists(dto.ownerId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const created = await this.prisma.customerEscalation.create({
      data: {
        customerId: dto.customerId,
        severity: dto.severity,
        slaTargetHrs: dto.slaTargetHrs,
        ownerId: dto.ownerId,
        status: 'Open',
        communications: dto.initialCommunication?.trim()
          ? {
              create: {
                channel: dto.initialChannel ?? 'Email',
                content: dto.initialCommunication.trim(),
                loggedBy: actorId,
              },
            }
          : undefined,
      },
      include: this.include(),
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ESCALATION_OPENED,
      recipientUserIds: [dto.ownerId],
      title: 'Customer escalation opened',
      body: `Escalation (${dto.severity}) assigned to you — SLA ${dto.slaTargetHrs}h.`,
      payload: {
        customerId: dto.customerId,
        escalationId: created.id,
        severity: dto.severity,
      },
      sourceObjectType: 'CustomerEscalation',
      sourceObjectId: created.id,
      actorId,
      includeActorAsRecipient: true,
    });

    if (
      isOverdue(created.createdAt, created.slaTargetHrs, created.status) ||
      dto.severity === 'Critical' ||
      dto.severity === 'High'
    ) {
      await this.notifyManagement(created, actorId);
    }

    return this.toDto(created);
  }

  async addCommunication(
    escalationId: string,
    dto: AddEscalationCommunicationDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<EscalationDto> {
    const existing = await this.prisma.customerEscalation.findUnique({
      where: { id: escalationId },
      select: { id: true, ownerId: true },
    });
    if (!existing) {
      throw new NotFoundException('Escalation not found');
    }
    this.assertCanActOnEscalation(existing.ownerId, caslUser);

    await this.prisma.escalationCommunication.create({
      data: {
        escalationId,
        channel: dto.channel,
        content: dto.content.trim(),
        loggedBy: actorId,
      },
    });

    const updated = await this.prisma.customerEscalation.findUniqueOrThrow({
      where: { id: escalationId },
      include: this.include(),
    });
    return this.toDto(updated);
  }

  async close(
    escalationId: string,
    dto: CloseEscalationDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<EscalationDto> {
    const existing = await this.prisma.customerEscalation.findUnique({
      where: { id: escalationId },
    });
    if (!existing) {
      throw new NotFoundException('Escalation not found');
    }
    this.assertCanActOnEscalation(existing.ownerId, caslUser);

    const breached = isOverdue(
      existing.createdAt,
      existing.slaTargetHrs,
      'Open',
    );

    const updated = await this.prisma.customerEscalation.update({
      where: { id: escalationId },
      data: {
        status: 'Closed',
        resolutionSummary: dto.resolutionSummary.trim(),
        closedAt: new Date(),
        slaBreached: breached,
      },
      include: this.include(),
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ESCALATION_CLOSED,
      recipientUserIds: [updated.ownerId],
      title: 'Customer escalation closed',
      body: `Escalation closed: ${dto.resolutionSummary.trim().slice(0, 120)}`,
      payload: {
        customerId: updated.customerId,
        escalationId: updated.id,
      },
      sourceObjectType: 'CustomerEscalation',
      sourceObjectId: updated.id,
      actorId,
      includeActorAsRecipient: true,
    });

    return this.toDto(updated);
  }

  /**
   * Cron entry: mark open escalations past SLA as breached and notify management.
   */
  async processSlaBreaches(): Promise<{ breached: number }> {
    const open = await this.prisma.customerEscalation.findMany({
      where: {
        status: { notIn: Array.from(CLOSED_STATUSES) },
        slaBreached: false,
      },
      select: {
        id: true,
        customerId: true,
        severity: true,
        ownerId: true,
        createdAt: true,
        slaTargetHrs: true,
        status: true,
      },
      take: 200,
    });

    let breached = 0;
    for (const row of open) {
      if (!isOverdue(row.createdAt, row.slaTargetHrs, row.status)) {
        continue;
      }
      await this.prisma.customerEscalation.update({
        where: { id: row.id },
        data: { slaBreached: true },
      });
      await this.notifyManagement(row, row.ownerId);
      breached += 1;
    }
    return { breached };
  }

  private assertCanActOnEscalation(
    ownerId: string,
    caslUser: CaslUserContext,
  ): void {
    if (!this.isAssigneeOnlyRole(caslUser.roleCode)) return;
    if (ownerId !== caslUser.id) {
      throw new ForbiddenException(
        'You can only act on escalations assigned to you',
      );
    }
  }

  private async notifyManagement(
    escalation: {
      id: string;
      customerId?: string;
      severity: string;
      ownerId: string;
    },
    actorId: string,
  ): Promise<void> {
    const managers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: MANAGEMENT_ROLES } },
      },
      select: { id: true },
      take: 50,
    });
    const recipientUserIds = Array.from(
      new Set(managers.map((m) => m.id).concat(escalation.ownerId)),
    );
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ESCALATION_MANAGEMENT,
      recipientUserIds,
      title: 'Escalation requires management attention',
      body: `High/overdue customer escalation (${escalation.severity}) needs review.`,
      payload: {
        customerId: escalation.customerId,
        escalationId: escalation.id,
        severity: escalation.severity,
      },
      sourceObjectType: 'CustomerEscalation',
      sourceObjectId: escalation.id,
      actorId,
      includeActorAsRecipient: true,
    });
  }

  private include() {
    return {
      owner: { select: { id: true, displayName: true, email: true } },
      customer: { select: { id: true, displayName: true } },
      communications: {
        include: {
          logger: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private async assertOwnerExists(ownerId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: ownerId, isActive: true },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('Owner user not found or inactive');
    }
  }

  private toDto(row: EscalationRow): EscalationDto {
    return {
      id: row.id,
      customerId: row.customerId,
      customerName: row.customer?.displayName,
      severity: row.severity,
      slaTargetHrs: row.slaTargetHrs,
      ownerId: row.ownerId,
      owner: row.owner
        ? {
            id: row.owner.id,
            displayName: row.owner.displayName,
            email: row.owner.email,
          }
        : undefined,
      status: row.status,
      resolutionSummary: row.resolutionSummary,
      slaBreached: row.slaBreached,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      communications: row.communications.map((c) => ({
        id: c.id,
        channel: c.channel,
        content: c.content,
        loggedBy: c.loggedBy,
        logger: c.logger
          ? {
              id: c.logger.id,
              displayName: c.logger.displayName,
              email: c.logger.email,
            }
          : undefined,
        createdAt: c.createdAt.toISOString(),
      })),
      isOverdue: isOverdue(row.createdAt, row.slaTargetHrs, row.status),
    };
  }
}
