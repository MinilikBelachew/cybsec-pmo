import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriorityLevel } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { ApiPriorityLevel } from '../projects/enums/project-api.enum';
import {
  ActionPointSourceType,
  CreateActionPointDto,
} from './dto/create-action-point.dto';
import { UpdateActionPointDto } from './dto/update-action-point.dto';
import { ActionPointDto } from './dto/action-point.dto';

const CLOSED_STATUSES = new Set(['Done', 'Cancelled']);
const ALLOWED_STATUSES = new Set(['Open', 'In Progress', 'Done', 'Cancelled']);

function startOfUtcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function asDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toIsoDate(value: Date): string {
  return asDateOnly(value).toISOString().slice(0, 10);
}

function isOverdue(dueDate: Date, status: string): boolean {
  if (CLOSED_STATUSES.has(status)) return false;
  return asDateOnly(dueDate) < startOfUtcToday();
}

@Injectable()
export class ActionPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notifications: NotificationsService,
  ) {}

  async listForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ActionPointDto[]> {
    await this.assertProjectAccess(projectId, caslUser);
    const rows = await this.prisma.actionPoint.findMany({
      where: { projectId },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async createForProject(
    projectId: string,
    dto: CreateActionPointDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<ActionPointDto> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }

    await this.assertOwnerExists(dto.ownerId);
    this.assertDueDateWithinProject(dto.dueDate, project.startDate, project.endDate);

    const sourceType = dto.sourceType ?? ActionPointSourceType.Project;
    let sourceId = dto.sourceId ?? projectId;

    if (sourceType === ActionPointSourceType.Task) {
      if (!dto.sourceId) {
        throw new BadRequestException('sourceId (task id) is required when sourceType is Task');
      }
      const task = await this.prisma.task.findFirst({
        where: { id: dto.sourceId, projectId },
        select: { id: true },
      });
      if (!task) {
        throw new BadRequestException('Task not found on this project');
      }
      sourceId = task.id;
    }

    const status = dto.status?.trim() || 'Open';
    this.assertStatus(status);

    const created = await this.prisma.actionPoint.create({
      data: {
        title: dto.title.trim(),
        ownerId: dto.ownerId,
        dueDate: asDateOnly(dto.dueDate),
        priority: (dto.priority ?? ApiPriorityLevel.Medium) as PriorityLevel,
        status,
        sourceType,
        sourceId,
        projectId,
        closedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ACTION_POINT_ASSIGNED,
      recipientUserIds: [dto.ownerId],
      title: 'Action point assigned',
      body: `You were assigned action point “${created.title}” (due ${toIsoDate(created.dueDate)}).`,
      payload: {
        projectId,
        actionPointId: created.id,
        dueDate: toIsoDate(created.dueDate),
      },
      sourceObjectType: 'ActionPoint',
      sourceObjectId: created.id,
      actorId,
      includeActorAsRecipient: true,
    });

    if (isOverdue(created.dueDate, created.status)) {
      await this.notifyOverdue(created.id, created.title, created.ownerId, projectId);
    }

    return this.toDto(created);
  }

  async updateForProject(
    projectId: string,
    actionPointId: string,
    dto: UpdateActionPointDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<ActionPointDto> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }

    const existing = await this.prisma.actionPoint.findFirst({
      where: { id: actionPointId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Action point not found');
    }

    if (dto.ownerId) {
      await this.assertOwnerExists(dto.ownerId);
    }
    if (dto.status) {
      this.assertStatus(dto.status.trim());
    }
    if (dto.dueDate) {
      this.assertDueDateWithinProject(
        dto.dueDate,
        project.startDate,
        project.endDate,
      );
    }

    const nextStatus = dto.status?.trim() ?? existing.status;
    const wasClosed = CLOSED_STATUSES.has(existing.status);
    const willClose = CLOSED_STATUSES.has(nextStatus);

    const updated = await this.prisma.actionPoint.update({
      where: { id: actionPointId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: asDateOnly(dto.dueDate) } : {}),
        ...(dto.priority !== undefined
          ? { priority: dto.priority as PriorityLevel }
          : {}),
        ...(dto.status !== undefined ? { status: nextStatus } : {}),
        ...(dto.closureNote !== undefined ? { closureNote: dto.closureNote } : {}),
        closedAt: willClose ? existing.closedAt ?? new Date() : null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (dto.ownerId && dto.ownerId !== existing.ownerId) {
      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.ACTION_POINT_ASSIGNED,
        recipientUserIds: [dto.ownerId],
        title: 'Action point assigned',
        body: `You were assigned action point “${updated.title}” (due ${toIsoDate(updated.dueDate)}).`,
        payload: {
          projectId,
          actionPointId: updated.id,
          dueDate: toIsoDate(updated.dueDate),
        },
        sourceObjectType: 'ActionPoint',
        sourceObjectId: updated.id,
        actorId,
        includeActorAsRecipient: true,
      });
    }

    const becameOverdue =
      isOverdue(updated.dueDate, updated.status) &&
      (!isOverdue(existing.dueDate, existing.status) ||
        dto.dueDate !== undefined ||
        dto.status !== undefined);

    if (becameOverdue && !wasClosed) {
      await this.notifyOverdue(updated.id, updated.title, updated.ownerId, projectId);
    }

    return this.toDto(updated);
  }

  async removeForProject(
    projectId: string,
    actionPointId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, caslUser);
    const existing = await this.prisma.actionPoint.findFirst({
      where: { id: actionPointId, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Action point not found');
    }
    await this.prisma.actionPoint.delete({ where: { id: actionPointId } });
  }

  private async notifyOverdue(
    actionPointId: string,
    title: string,
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ACTION_POINT_OVERDUE,
      recipientUserIds: [ownerId],
      title: 'Action point overdue',
      body: `Action point “${title}” is overdue.`,
      payload: { projectId, actionPointId },
      sourceObjectType: 'ActionPoint',
      sourceObjectId: actionPointId,
      includeActorAsRecipient: true,
    });
  }

  private assertDueDateWithinProject(
    dueDate: Date,
    projectStart: Date,
    projectEnd: Date,
  ): void {
    const due = asDateOnly(dueDate);
    const start = asDateOnly(projectStart);
    const end = asDateOnly(projectEnd);
    if (due < start) {
      throw new BadRequestException(
        `Due date cannot be before the project start date (${toIsoDate(start)})`,
      );
    }
    if (due > end) {
      throw new BadRequestException(
        `Due date cannot be after the project end date (${toIsoDate(end)})`,
      );
    }
  }

  private async assertProjectAccess(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }
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

  private assertStatus(status: string): void {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new BadRequestException(
        'Status must be one of: Open, In Progress, Done, Cancelled',
      );
    }
  }

  private toDto(row: {
    id: string;
    title: string;
    sourceType: string;
    sourceId: string;
    projectId: string | null;
    ownerId: string;
    dueDate: Date;
    priority: string;
    status: string;
    closureNote: string | null;
    closedAt: Date | null;
    createdAt: Date;
    owner?: { id: string; displayName: string; email: string } | null;
  }): ActionPointDto {
    return {
      id: row.id,
      title: row.title,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      projectId: row.projectId,
      ownerId: row.ownerId,
      owner: row.owner
        ? {
            id: row.owner.id,
            displayName: row.owner.displayName,
            email: row.owner.email,
          }
        : undefined,
      dueDate: toIsoDate(row.dueDate),
      priority: row.priority,
      status: row.status,
      closureNote: row.closureNote,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      isOverdue: isOverdue(row.dueDate, row.status),
    };
  }
}
