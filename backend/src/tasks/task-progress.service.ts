import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AppAbility, CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { AuditLogsService } from '../audit/audit-logs.service';
import { CreateProgressUpdateDto } from './dto/create-progress-update.dto';
import { ProgressEvidenceFileDto } from './dto/progress-evidence-file.dto';
import {
  ProgressReviewDecisionEnum,
  ReviewProgressUpdateDto,
} from './dto/review-progress-update.dto';
import { QueryProgressReviewDto } from './dto/query-progress-review.dto';

const PROGRESS_INCLUDE = {
  engineer: { select: { id: true, displayName: true, email: true } },
  reviewer: { select: { id: true, displayName: true, email: true } },
  task: {
    select: {
      id: true,
      title: true,
      projectId: true,
      ownerId: true,
      status: true,
      project: { select: { id: true, name: true, primaryPmId: true, secondaryPmId: true } },
    },
  },
} as const;

const SUBMITTABLE_STATUSES: TaskStatus[] = [
  TaskStatus.In_Progress,
  TaskStatus.Rework,
];

@Injectable()
export class TaskProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async submit(
    taskId: string,
    dto: CreateProgressUpdateDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const task = await this.loadTaskInScope(taskId, caslUser, 'update');

    if (task.ownerId !== actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { task: 'onlyTaskOwnerCanSubmitProgress' },
      });
    }

    if (!SUBMITTABLE_STATUSES.includes(task.status)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { status: 'taskMustBeInProgressOrReworkToSubmitProgress' },
      });
    }

    if (dto.progressPercent <= task.progressApproved) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          progressPercent: `progressMustExceedApprovedTotal (${task.progressApproved}%)`,
        },
      });
    }

    const pending = await this.prisma.taskProgressUpdate.findFirst({
      where: { taskId, status: 'Pending' },
    });

    if (pending) {
      throw new ConflictException({
        status: HttpStatus.CONFLICT,
        errors: { progress: 'pendingProgressUpdateAlreadyExists' },
      });
    }

    const evidenceFiles = this.normalizeEvidenceFiles(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      const update = await tx.taskProgressUpdate.create({
        data: {
          taskId,
          engineerId: actorId,
          progressPercent: dto.progressPercent,
          hoursSpent: dto.hoursSpent,
          comment: dto.comment?.trim() || null,
          s3EvidenceKey: evidenceFiles[0]?.storageKey ?? null,
          evidenceFiles:
            evidenceFiles.length > 0
              ? (evidenceFiles as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          status: 'Pending',
        },
        include: PROGRESS_INCLUDE,
      });

      await tx.task.update({
        where: { id: taskId },
        data: {
          progressPending: dto.progressPercent,
          status: TaskStatus.Submitted_for_Review,
        },
      });

      return update;
    });

    await this.logTaskStatusChangeIfNeeded(
      taskId,
      task.status,
      TaskStatus.Submitted_for_Review,
      actorId,
      { progressUpdateId: result.id, reason: 'progress_submitted' },
    );

    const pmIds = await this.notificationsService.resolveProjectPmUserIds(task.projectId);
    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.PROGRESS_SUBMITTED,
      recipientUserIds: pmIds,
      title: 'Progress submitted for review',
      body: `${result.engineer.displayName} submitted progress (${dto.progressPercent}%) on "${result.task.title}".`,
      payload: this.buildPayload(result.task, result.id, { forPmReview: true }),
      sourceObjectType: 'TaskProgressUpdate',
      sourceObjectId: result.id,
      actorId,
    });

    return this.formatProgressUpdate(result);
  }

  async findForTask(
    taskId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    await this.loadTaskInScope(taskId, caslUser, 'read');

    const rows = await this.prisma.taskProgressUpdate.findMany({
      where: { taskId },
      include: PROGRESS_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.formatProgressUpdate(row));
  }

  async findPendingReview(
    query: QueryProgressReviewDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    if (!ability.can('approve', 'Task')) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { progress: 'progressReviewNotPermitted' },
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskProgressUpdateWhereInput = {
      status: 'Pending',
      task: {
        AND: [
          this.recordScopeWhere.taskWhere(caslUser, 'read'),
          ...(query.projectId ? [{ projectId: query.projectId }] : []),
        ],
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.taskProgressUpdate.findMany({
        where,
        include: PROGRESS_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.taskProgressUpdate.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.formatProgressUpdate(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async review(
    taskId: string,
    updateId: string,
    dto: ReviewProgressUpdateDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    if (!ability.can('approve', 'Task')) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { progress: 'progressReviewNotPermitted' },
      });
    }

    await this.loadTaskInScope(taskId, caslUser, 'update');

    const update = await this.prisma.taskProgressUpdate.findFirst({
      where: { id: updateId, taskId, status: 'Pending' },
      include: PROGRESS_INCLUDE,
    });

    if (!update) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { progress: 'pendingProgressUpdateNotFound' },
      });
    }

    if (update.engineerId === actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { progress: 'cannotReviewOwnProgressSubmission' },
      });
    }

    if (
      (dto.decision === ProgressReviewDecisionEnum.Reject ||
        dto.decision === ProgressReviewDecisionEnum.Rework) &&
      !dto.reviewReason?.trim()
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { reviewReason: 'reviewReasonRequired' },
      });
    }

    const reviewedAt = new Date();
    const reviewReason = dto.reviewReason?.trim() || null;

    if (dto.decision === ProgressReviewDecisionEnum.Approve) {
      return this.applyApproval(update, actorId, reviewedAt);
    }

    if (dto.decision === ProgressReviewDecisionEnum.Reject) {
      return this.applyRejection(update, actorId, reviewedAt, reviewReason!);
    }

    return this.applyRework(update, actorId, reviewedAt, reviewReason!);
  }

  private async applyApproval(
    update: Prisma.TaskProgressUpdateGetPayload<{ include: typeof PROGRESS_INCLUDE }>,
    actorId: string,
    reviewedAt: Date,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.taskProgressUpdate.update({
        where: { id: update.id },
        data: {
          status: 'Approved',
          reviewedBy: actorId,
          reviewedAt,
        },
        include: PROGRESS_INCLUDE,
      });

      await tx.task.update({
        where: { id: update.taskId },
        data: {
          progressApproved: update.progressPercent,
          progressPending: 0,
          status:
            update.progressPercent >= 100
              ? TaskStatus.Approved
              : TaskStatus.In_Progress,
        },
      });

      return reviewed;
    });

    const nextStatus =
      update.progressPercent >= 100 ? TaskStatus.Approved : TaskStatus.In_Progress;
    await this.logTaskStatusChangeIfNeeded(
      update.taskId,
      update.task.status,
      nextStatus,
      actorId,
      { progressUpdateId: update.id, decision: 'approve' },
    );

    const approvedPercent = update.progressPercent;
    const remainingPercent = Math.max(0, 100 - approvedPercent);
    const isFullyApproved = approvedPercent >= 100;

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.PROGRESS_APPROVED,
      recipientUserIds: [update.engineerId],
      title: 'Progress approved',
      body: isFullyApproved
        ? `Your progress update (100%) on "${update.task.title}" was approved. The PM can mark the task Done when ready.`
        : `Your progress (${approvedPercent}%) on "${update.task.title}" was approved. Continue work on the remaining ${remainingPercent}% and submit your next update when ready.`,
      payload: this.buildPayload(update.task, update.id),
      sourceObjectType: 'TaskProgressUpdate',
      sourceObjectId: update.id,
      actorId,
    });

    return this.formatProgressUpdate(result);
  }

  private async applyRejection(
    update: Prisma.TaskProgressUpdateGetPayload<{ include: typeof PROGRESS_INCLUDE }>,
    actorId: string,
    reviewedAt: Date,
    reviewReason: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.taskProgressUpdate.update({
        where: { id: update.id },
        data: {
          status: 'Rejected',
          reviewedBy: actorId,
          reviewedAt,
          reviewReason,
        },
        include: PROGRESS_INCLUDE,
      });

      await tx.task.update({
        where: { id: update.taskId },
        data: {
          progressPending: 0,
          status: TaskStatus.In_Progress,
        },
      });

      return reviewed;
    });

    await this.logTaskStatusChangeIfNeeded(
      update.taskId,
      update.task.status,
      TaskStatus.In_Progress,
      actorId,
      { progressUpdateId: update.id, decision: 'reject' },
    );

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.PROGRESS_REJECTED,
      recipientUserIds: [update.engineerId],
      title: 'Progress rejected',
      body: `Your progress update on "${update.task.title}" was rejected: ${reviewReason}`,
      payload: this.buildPayload(update.task, update.id),
      sourceObjectType: 'TaskProgressUpdate',
      sourceObjectId: update.id,
      actorId,
    });

    return this.formatProgressUpdate(result);
  }

  private async applyRework(
    update: Prisma.TaskProgressUpdateGetPayload<{ include: typeof PROGRESS_INCLUDE }>,
    actorId: string,
    reviewedAt: Date,
    reviewReason: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.taskProgressUpdate.update({
        where: { id: update.id },
        data: {
          status: 'Rework',
          reviewedBy: actorId,
          reviewedAt,
          reviewReason,
        },
        include: PROGRESS_INCLUDE,
      });

      await tx.task.update({
        where: { id: update.taskId },
        data: {
          progressPending: 0,
          status: TaskStatus.Rework,
        },
      });

      return reviewed;
    });

    await this.logTaskStatusChangeIfNeeded(
      update.taskId,
      update.task.status,
      TaskStatus.Rework,
      actorId,
      { progressUpdateId: update.id, decision: 'rework' },
    );

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.PROGRESS_REWORK,
      recipientUserIds: [update.engineerId],
      title: 'Rework requested',
      body: `Rework requested on "${update.task.title}": ${reviewReason}`,
      payload: this.buildPayload(update.task, update.id),
      sourceObjectType: 'TaskProgressUpdate',
      sourceObjectId: update.id,
      actorId,
    });

    return this.formatProgressUpdate(result);
  }

  private async logTaskStatusChangeIfNeeded(
    taskId: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus,
    actorId: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (fromStatus === toStatus) {
      return;
    }

    try {
      await this.auditLogsService.logStatusChange({
        actorId,
        objectType: 'Task',
        objectId: taskId,
        fromStatus,
        toStatus,
        context,
      });
    } catch {
      // Audit must not block progress workflow.
    }
  }

  private async loadTaskInScope(
    taskId: string,
    caslUser: CaslUserContext,
    action: 'read' | 'update',
  ) {
    const task = await this.prisma.task.findFirst({
      where: {
        AND: [{ id: taskId }, this.recordScopeWhere.taskWhere(caslUser, action)],
      },
      select: {
        id: true,
        projectId: true,
        ownerId: true,
        status: true,
        title: true,
        progressApproved: true,
      },
    });

    if (!task) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    return task;
  }

  private buildPayload(
    task: {
      id: string;
      projectId: string;
      title: string;
      project?: { name?: string | null } | null;
    },
    progressUpdateId: string,
    options?: { forPmReview?: boolean },
  ) {
    const params = new URLSearchParams({
      taskId: task.id,
    });

    if (options?.forPmReview) {
      params.set('reviewProgress', '1');
      params.set('progressUpdateId', progressUpdateId);
    } else {
      params.set('progress', '1');
    }

    return {
      taskId: task.id,
      projectId: task.projectId,
      projectName: task.project?.name ?? null,
      taskTitle: task.title,
      progressUpdateId,
      link: `/dashboard/projects/${task.projectId}?${params.toString()}`,
    };
  }

  private normalizeEvidenceFiles(
    dto: CreateProgressUpdateDto,
  ): ProgressEvidenceFileDto[] {
    const byKey = new Map<string, ProgressEvidenceFileDto>();

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
      byKey.set(legacyKey, { storageKey: legacyKey, filename: 'Evidence file' });
    }

    return Array.from(byKey.values());
  }

  private parseStoredEvidenceFiles(
    row: Prisma.TaskProgressUpdateGetPayload<{ include: typeof PROGRESS_INCLUDE }>,
  ): { storageKey: string; filename: string }[] {
    const parsed: ProgressEvidenceFileDto[] = [];

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

  private formatProgressUpdate(
    row: Prisma.TaskProgressUpdateGetPayload<{ include: typeof PROGRESS_INCLUDE }>,
  ) {
    const evidenceFiles = this.parseStoredEvidenceFiles(row);

    return {
      id: row.id,
      taskId: row.taskId,
      engineerId: row.engineerId,
      progressPercent: row.progressPercent,
      hoursSpent: Number(row.hoursSpent),
      comment: row.comment,
      s3EvidenceKey: row.s3EvidenceKey,
      evidenceUrl: null,
      evidenceFiles,
      status: row.status,
      reviewedBy: row.reviewedBy,
      reviewReason: row.reviewReason,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      engineer: row.engineer,
      reviewer: row.reviewer,
      task: row.task
        ? {
            id: row.task.id,
            title: row.task.title,
            projectId: row.task.projectId,
          }
        : undefined,
    };
  }
}
