import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriorityLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { AlertEngineService } from '../alerts/alert-engine.service';
import { ApiPriorityLevel } from '../projects/enums/project-api.enum';
import { RoleEnum } from '../roles/roles.enum';
import { CreateIssueDto } from './dto/create-issue.dto';
import { CloseIssueDto, UpdateIssueDto } from './dto/update-issue.dto';
import { IssueEvidenceFileDto } from './dto/issue-evidence-file.dto';
import { IssueDto } from './dto/issue.dto';

const CLOSED_STATUSES = new Set(['Resolved', 'Closed', 'Cancelled']);
const ALLOWED_STATUSES = new Set([
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
  'Cancelled',
]);
const HIGH_PRIORITIES = new Set<string>([
  ApiPriorityLevel.High,
  ApiPriorityLevel.Critical,
  PriorityLevel.High,
  PriorityLevel.Critical,
]);

/** Engineers only see issues they own and may update status only. */
const ISSUE_ASSIGNEE_ROLES = new Set<string>([RoleEnum.engineer]);

/** Roles that may create/edit/delete issues (matches issues:edit in RBAC seed). */
const ISSUE_MANAGER_ROLES = new Set<string>([
  RoleEnum.super_admin,
  RoleEnum.it_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
]);

function startOfUtcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function asDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return asDateOnly(value).toISOString().slice(0, 10);
}

function isOverdue(
  dueDate: Date,
  expectedResolutionDate: Date | null,
  status: string,
): boolean {
  if (CLOSED_STATUSES.has(status)) return false;
  const target = expectedResolutionDate ?? dueDate;
  return asDateOnly(target) < startOfUtcToday();
}

function requiresEscalation(
  priority: string,
  dueDate: Date,
  expectedResolutionDate: Date | null,
  status: string,
): boolean {
  if (CLOSED_STATUSES.has(status)) return false;
  return (
    HIGH_PRIORITIES.has(priority) ||
    isOverdue(dueDate, expectedResolutionDate, status)
  );
}

type IssueRow = Prisma.IssueGetPayload<{
  include: {
    owner: { select: { id: true; displayName: true; email: true } };
    raiser: { select: { id: true; displayName: true; email: true } };
    project: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notifications: NotificationsService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  private isAssigneeOnlyRole(roleCode?: string | null): boolean {
    return Boolean(roleCode && ISSUE_ASSIGNEE_ROLES.has(roleCode));
  }

  private isIssueManager(roleCode?: string | null): boolean {
    return Boolean(roleCode && ISSUE_MANAGER_ROLES.has(roleCode));
  }

  private ownerScope(caslUser: CaslUserContext): { ownerId: string } | object {
    return this.isAssigneeOnlyRole(caslUser.roleCode)
      ? { ownerId: caslUser.id }
      : {};
  }

  async listPortfolio(
    caslUser: CaslUserContext,
    filters?: { projectId?: string; status?: string },
  ): Promise<IssueDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const rows = await this.prisma.issue.findMany({
      where: {
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...this.ownerScope(caslUser),
        project: { AND: [scopeWhere] },
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        raiser: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<IssueDto[]> {
    await this.assertProjectAccess(projectId, caslUser);
    const rows = await this.prisma.issue.findMany({
      where: { projectId, ...this.ownerScope(caslUser) },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        raiser: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async createForProject(
    projectId: string,
    dto: CreateIssueDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<IssueDto> {
    if (this.isAssigneeOnlyRole(caslUser.roleCode)) {
      throw new ForbiddenException('You cannot create issues');
    }
    await this.assertProjectAccess(projectId, caslUser);
    await this.assertOwnerExists(dto.ownerId);

    const status = dto.status?.trim() || 'Open';
    this.assertStatus(status);

    const created = await this.prisma.issue.create({
      data: {
        projectId,
        title: dto.title.trim(),
        priority: dto.priority as PriorityLevel,
        ownerId: dto.ownerId,
        dueDate: asDateOnly(dto.dueDate),
        expectedResolutionDate: dto.expectedResolutionDate
          ? asDateOnly(dto.expectedResolutionDate)
          : null,
        status,
        raisedBy: actorId,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        raiser: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ISSUE_ASSIGNED,
      recipientUserIds: await this.notifications.recipientsWithProjectPms(
        projectId,
        dto.ownerId,
      ),
      title: 'Issue assigned',
      body: `You were assigned issue “${created.title}” (${created.priority}).`,
      payload: {
        projectId,
        issueId: created.id,
        priority: created.priority,
      },
      sourceObjectType: 'Issue',
      sourceObjectId: created.id,
      actorId,
      includeActorAsRecipient: true,
    });

    if (
      requiresEscalation(
        created.priority,
        created.dueDate,
        created.expectedResolutionDate,
        created.status,
      )
    ) {
      await this.notifyEscalated(created, actorId);
    }

    return this.toDto(created);
  }

  async updateForProject(
    projectId: string,
    issueId: string,
    dto: UpdateIssueDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<IssueDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Issue not found');
    }

    const isAssigneeOnly = this.isAssigneeOnlyRole(caslUser.roleCode);
    const isOwner =
      existing.ownerId === caslUser.id || existing.ownerId === actorId;

    if (isAssigneeOnly) {
      if (!isOwner) {
        throw new ForbiddenException(
          'You can only update issues assigned to you',
        );
      }
      const forbiddenKeys = (
        [
          'title',
          'priority',
          'ownerId',
          'dueDate',
          'expectedResolutionDate',
          'resolutionNote',
          's3EvidenceKey',
          'evidenceFiles',
        ] as const
      ).filter((key) => dto[key] !== undefined);
      if (forbiddenKeys.length > 0) {
        throw new ForbiddenException(
          'You can only update the status of issues assigned to you',
        );
      }
      if (dto.status === undefined) {
        throw new BadRequestException('No allowed fields to update');
      }
    } else if (!this.isIssueManager(caslUser.roleCode)) {
      throw new ForbiddenException('You cannot update this issue');
    }

    if (dto.ownerId) {
      await this.assertOwnerExists(dto.ownerId);
    }
    if (dto.status) {
      this.assertStatus(dto.status.trim());
    }

    const nextStatus = dto.status?.trim() ?? existing.status;
    const wasClosed = CLOSED_STATUSES.has(existing.status);
    const willClose = CLOSED_STATUSES.has(nextStatus);

    const evidenceProvided =
      dto.evidenceFiles !== undefined || dto.s3EvidenceKey !== undefined;
    const normalizedEvidence = evidenceProvided
      ? this.normalizeEvidenceFiles(dto)
      : null;

    const updated = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...(!isAssigneeOnly && dto.title !== undefined
          ? { title: dto.title.trim() }
          : {}),
        ...(!isAssigneeOnly && dto.priority !== undefined
          ? { priority: dto.priority as PriorityLevel }
          : {}),
        ...(!isAssigneeOnly && dto.ownerId !== undefined
          ? { ownerId: dto.ownerId }
          : {}),
        ...(!isAssigneeOnly && dto.dueDate !== undefined
          ? { dueDate: asDateOnly(dto.dueDate) }
          : {}),
        ...(!isAssigneeOnly && dto.expectedResolutionDate !== undefined
          ? {
              expectedResolutionDate: dto.expectedResolutionDate
                ? asDateOnly(dto.expectedResolutionDate)
                : null,
            }
          : {}),
        ...(dto.status !== undefined ? { status: nextStatus } : {}),
        ...(!isAssigneeOnly && dto.resolutionNote !== undefined
          ? { resolutionNote: dto.resolutionNote }
          : {}),
        ...(!isAssigneeOnly && normalizedEvidence
          ? {
              s3EvidenceKey: normalizedEvidence[0]?.storageKey ?? null,
              evidenceFiles:
                normalizedEvidence.length > 0
                  ? (normalizedEvidence as unknown as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        raiser: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!isAssigneeOnly && dto.ownerId && dto.ownerId !== existing.ownerId) {
      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.ISSUE_ASSIGNED,
        recipientUserIds: await this.notifications.recipientsWithProjectPms(
          projectId,
          dto.ownerId,
        ),
        title: 'Issue assigned',
        body: `You were assigned issue “${updated.title}” (${updated.priority}).`,
        payload: {
          projectId,
          issueId: updated.id,
          priority: updated.priority,
        },
        sourceObjectType: 'Issue',
        sourceObjectId: updated.id,
        actorId,
        includeActorAsRecipient: true,
      });
    }

    const nowEscalates = requiresEscalation(
      updated.priority,
      updated.dueDate,
      updated.expectedResolutionDate,
      updated.status,
    );
    const previouslyEscalated = requiresEscalation(
      existing.priority,
      existing.dueDate,
      existing.expectedResolutionDate,
      existing.status,
    );
    if (nowEscalates && !previouslyEscalated && !wasClosed) {
      await this.notifyEscalated(updated, actorId);
    }

    if (willClose && !wasClosed) {
      await this.notifyClosed(updated, actorId);
    }

    return this.toDto(updated);
  }

  async closeForProject(
    projectId: string,
    issueId: string,
    dto: CloseIssueDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<IssueDto> {
    if (this.isAssigneeOnlyRole(caslUser.roleCode)) {
      // Assignees close via status-only PATCH; dedicated close with notes is manager-only.
      if (
        dto.resolutionNote !== undefined ||
        dto.s3EvidenceKey !== undefined ||
        dto.evidenceFiles !== undefined
      ) {
        throw new ForbiddenException(
          'You can only update the status of issues assigned to you',
        );
      }
      return this.updateForProject(
        projectId,
        issueId,
        { status: 'Closed' },
        actorId,
        caslUser,
      );
    }
    return this.updateForProject(
      projectId,
      issueId,
      {
        status: 'Closed',
        resolutionNote: dto.resolutionNote,
        s3EvidenceKey: dto.s3EvidenceKey,
        evidenceFiles: dto.evidenceFiles,
      },
      actorId,
      caslUser,
    );
  }

  async removeForProject(
    projectId: string,
    issueId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    if (this.isAssigneeOnlyRole(caslUser.roleCode)) {
      throw new ForbiddenException('You cannot delete issues');
    }
    await this.assertProjectAccess(projectId, caslUser);
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Issue not found');
    }
    await this.prisma.issue.delete({ where: { id: issueId } });
  }

  private async notifyEscalated(
    issue: {
      id: string;
      title: string;
      ownerId: string;
      projectId: string;
      priority: string;
    },
    actorId: string,
  ): Promise<void> {
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ISSUE_ESCALATED,
      recipientUserIds: await this.notifications.recipientsWithProjectPms(
        issue.projectId,
        issue.ownerId,
      ),
      title: 'Issue escalated',
      body: `Issue “${issue.title}” requires escalation (${issue.priority} / overdue).`,
      payload: {
        projectId: issue.projectId,
        issueId: issue.id,
        priority: issue.priority,
        link: '/dashboard/alerts',
      },
      sourceObjectType: 'Issue',
      sourceObjectId: issue.id,
      actorId,
      includeActorAsRecipient: true,
    });

    await this.alertEngine.fire({
      eventType: 'ISSUE_ESCALATED',
      objectType: 'Issue',
      objectId: issue.id,
      title: 'Issue escalated',
      body: `Issue “${issue.title}” requires escalation (${issue.priority} / overdue).`,
      payload: {
        projectId: issue.projectId,
        issueId: issue.id,
        priority: issue.priority,
        link: '/dashboard/alerts',
      },
      actorId,
    });
  }

  private async notifyClosed(
    issue: {
      id: string;
      title: string;
      raisedBy: string;
      ownerId: string;
      projectId: string;
    },
    actorId: string,
  ): Promise<void> {
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ISSUE_CLOSED,
      recipientUserIds: await this.notifications.recipientsWithProjectPms(
        issue.projectId,
        issue.raisedBy,
        issue.ownerId,
      ),
      title: 'Issue closed',
      body: `Issue “${issue.title}” was closed.`,
      payload: {
        projectId: issue.projectId,
        issueId: issue.id,
      },
      sourceObjectType: 'Issue',
      sourceObjectId: issue.id,
      actorId,
      includeActorAsRecipient: true,
    });
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

  private normalizeEvidenceFiles(dto: {
    evidenceFiles?: IssueEvidenceFileDto[];
    s3EvidenceKey?: string | null;
  }): IssueEvidenceFileDto[] {
    const byKey = new Map<string, IssueEvidenceFileDto>();

    for (const file of dto.evidenceFiles ?? []) {
      const storageKey = file.storageKey?.trim();
      if (!storageKey) continue;
      byKey.set(storageKey, {
        storageKey,
        filename: file.filename?.trim() || 'Evidence file',
      });
    }

    const legacyKey = dto.s3EvidenceKey?.trim();
    if (legacyKey && !byKey.has(legacyKey)) {
      byKey.set(legacyKey, {
        storageKey: legacyKey,
        filename: 'Evidence file',
      });
    }

    return Array.from(byKey.values());
  }

  private parseStoredEvidenceFiles(row: {
    evidenceFiles?: Prisma.JsonValue | null;
    s3EvidenceKey?: string | null;
  }): IssueEvidenceFileDto[] {
    const parsed: IssueEvidenceFileDto[] = [];

    if (Array.isArray(row.evidenceFiles)) {
      for (const item of row.evidenceFiles) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const storageKey =
          typeof record.storageKey === 'string' ? record.storageKey.trim() : '';
        if (!storageKey) continue;
        parsed.push({
          storageKey,
          filename:
            typeof record.filename === 'string' && record.filename.trim()
              ? record.filename.trim()
              : 'Evidence file',
        });
      }
    }

    if (parsed.length === 0 && row.s3EvidenceKey) {
      parsed.push({
        storageKey: row.s3EvidenceKey,
        filename: 'Evidence file',
      });
    }

    return parsed;
  }

  private assertStatus(status: string): void {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new BadRequestException(
        'Status must be one of: Open, In Progress, Resolved, Closed, Cancelled',
      );
    }
  }

  private toDto(row: IssueRow): IssueDto {
    const evidenceFiles = this.parseStoredEvidenceFiles(row);
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.project?.name,
      title: row.title,
      priority: row.priority,
      ownerId: row.ownerId,
      owner: row.owner
        ? {
            id: row.owner.id,
            displayName: row.owner.displayName,
            email: row.owner.email,
          }
        : undefined,
      dueDate: toIsoDate(row.dueDate)!,
      expectedResolutionDate: toIsoDate(row.expectedResolutionDate),
      status: row.status,
      resolutionNote: row.resolutionNote,
      s3EvidenceKey: evidenceFiles[0]?.storageKey ?? row.s3EvidenceKey,
      evidenceFiles,
      raisedBy: row.raisedBy,
      raiser: row.raiser
        ? {
            id: row.raiser.id,
            displayName: row.raiser.displayName,
            email: row.raiser.email,
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      isOverdue: isOverdue(
        row.dueDate,
        row.expectedResolutionDate,
        row.status,
      ),
      requiresEscalation: requiresEscalation(
        row.priority,
        row.dueDate,
        row.expectedResolutionDate,
        row.status,
      ),
    };
  }
}
