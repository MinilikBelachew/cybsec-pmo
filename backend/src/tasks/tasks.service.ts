import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppAbility, CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CreateTaskDto, TaskStatusEnum } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkTasksDto } from './dto/bulk-tasks.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import {
  CreateTaskChecklistItemDto,
  UpdateTaskChecklistItemDto,
} from './dto/task-checklist.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { CreateTaskBundleDto } from './dto/create-task-bundle.dto';
import { UpdateTaskBundleDto } from './dto/update-task-bundle.dto';
import { FilesUploadService, UploadedFileResult } from '../files/files-upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { ProjectTeamService } from '../projects/project-team.service';
import { LeaveBackupService } from '../resources/leave-backup.service';
import { TaskDependenciesService } from './task-dependencies.service';
import { WorkspaceDocumentsService, TASK_ATTACHMENT_MAX_FILES } from '../workspace-documents/workspace-documents.service';
import { TaskStatus, PriorityLevel, Prisma } from '@prisma/client';
import { RoleEnum } from '../roles/roles.enum';

const EXTERNAL_ROLES = [RoleEnum.client, RoleEnum.vendor];

const TASK_INCLUDE = {
  project: { select: { id: true, name: true } },
  owner: {
    select: {
      id: true,
      displayName: true,
      email: true,
      employees: { select: { id: true } },
    },
  },
  backupOwner: { select: { id: true, displayName: true, email: true } },
  parentTask: {
    select: { id: true, title: true, startDate: true, endDate: true, ownerId: true },
  },
  phase: { select: { id: true, name: true } },
  subTasks: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      owner: { select: { id: true, displayName: true, email: true } },
      startDate: true,
      endDate: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  comments: {
    include: {
      author: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  workspaceDocuments: {
    where: { category: 'Task' },
    include: {
      uploader: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

const LEGAL_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  To_Do: [TaskStatus.In_Progress],
  In_Progress: [TaskStatus.To_Do, TaskStatus.Submitted_for_Review],
  Submitted_for_Review: [TaskStatus.Approved, TaskStatus.Rework],
  Approved: [TaskStatus.Done],
  Rework: [TaskStatus.In_Progress, TaskStatus.Submitted_for_Review],
  Done: [],
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesUploadService: FilesUploadService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notificationsService: NotificationsService,
    private readonly projectTeamService: ProjectTeamService,
    private readonly leaveBackupService: LeaveBackupService,
    private readonly taskDependenciesService: TaskDependenciesService,
    private readonly workspaceDocumentsService: WorkspaceDocumentsService,
  ) {}

  private mapStatusToPrisma(status: TaskStatusEnum): TaskStatus {
    const map: Record<TaskStatusEnum, TaskStatus> = {
      [TaskStatusEnum.To_Do]: TaskStatus.To_Do,
      [TaskStatusEnum.In_Progress]: TaskStatus.In_Progress,
      [TaskStatusEnum.Submitted_for_Review]: TaskStatus.Submitted_for_Review,
      [TaskStatusEnum.Approved]: TaskStatus.Approved,
      [TaskStatusEnum.Rework]: TaskStatus.Rework,
      [TaskStatusEnum.Done]: TaskStatus.Done,
    };
    return map[status];
  }

  private mapStatusToApi(status: TaskStatus): TaskStatusEnum {
    const map: Record<TaskStatus, TaskStatusEnum> = {
      [TaskStatus.To_Do]: TaskStatusEnum.To_Do,
      [TaskStatus.In_Progress]: TaskStatusEnum.In_Progress,
      [TaskStatus.Submitted_for_Review]: TaskStatusEnum.Submitted_for_Review,
      [TaskStatus.Approved]: TaskStatusEnum.Approved,
      [TaskStatus.Rework]: TaskStatusEnum.Rework,
      [TaskStatus.Done]: TaskStatusEnum.Done,
    };
    return map[status];
  }

  private isExternalRole(roleCode?: string | null): boolean {
    return !!roleCode && EXTERNAL_ROLES.includes(roleCode as RoleEnum);
  }

  private resolveRoleCode(user: { role?: { code?: string }; roleCode?: string }): string | undefined {
    return user.role?.code;
  }

  private filterCommentsForRole<T extends { isInternal: boolean }>(
    comments: T[],
    roleCode?: string | null,
  ): T[] {
    if (this.isExternalRole(roleCode)) {
      return comments.filter((c) => !c.isInternal);
    }
    return comments;
  }

  private formatTask(
    task: Awaited<ReturnType<typeof this.prisma.task.findUnique>> & object,
    roleCode?: string | null,
  ) {
    const { comments, workspaceDocuments, ...rest } = task as any;
    return {
      ...rest,
      comments: this.filterCommentsForRole(comments ?? [], roleCode),
      attachments: (workspaceDocuments ?? []).map((a: any) =>
        this.workspaceDocumentsService.mapAsTaskAttachment(a),
      ),
    };
  }

  private async attachScheduleImpact<T extends Record<string, unknown>>(task: T) {
    const scheduleImpact = await this.leaveBackupService.resolveTaskScheduleImpact({
      id: String(task.id),
      projectId: String(task.projectId),
      priority: task.priority as PriorityLevel,
      isOnCriticalPath: Boolean(task.isOnCriticalPath),
      startDate: task.startDate ? new Date(String(task.startDate)) : null,
      endDate: task.endDate ? new Date(String(task.endDate)) : null,
      ownerId: (task.ownerId as string | null) ?? null,
      backupOwnerId: (task.backupOwnerId as string | null) ?? null,
      owner: task.owner as { employees?: { id: string } | null } | null,
    });

    return { ...task, scheduleImpact };
  }

  private async attachEffortVariance<T extends { id: string; effortHours?: unknown }>(
    task: T,
  ): Promise<
    T & {
      actualHoursLogged: number;
      effortVarianceHours: number | null;
      isOverEffort: boolean;
    }
  > {
    const [enriched] = await this.attachEffortVarianceMany([task]);
    return enriched;
  }

  private async attachEffortVarianceMany<
    T extends { id: string; effortHours?: unknown },
  >(
    tasks: T[],
  ): Promise<
    Array<
      T & {
        actualHoursLogged: number;
        effortVarianceHours: number | null;
        isOverEffort: boolean;
      }
    >
  > {
    if (tasks.length === 0) {
      return [];
    }

    const aggregates = await this.prisma.taskProgressUpdate.groupBy({
      by: ['taskId'],
      where: {
        taskId: { in: tasks.map((task) => task.id) },
        status: { in: ['Pending', 'Approved'] },
      },
      _sum: { hoursSpent: true },
    });

    const loggedByTaskId = new Map(
      aggregates.map((row) => [row.taskId, Number(row._sum.hoursSpent ?? 0)]),
    );

    return tasks.map((task) => {
      const actualHoursLogged = loggedByTaskId.get(task.id) ?? 0;
      const planned =
        task.effortHours != null && Number.isFinite(Number(task.effortHours))
          ? Number(task.effortHours)
          : null;
      const effortVarianceHours =
        planned != null
          ? Math.round((actualHoursLogged - planned) * 100) / 100
          : null;
      const isOverEffort =
        planned != null && planned > 0 && actualHoursLogged > planned;

      return {
        ...task,
        actualHoursLogged,
        effortVarianceHours,
        isOverEffort,
      };
    });
  }

  private formatDateParam(value?: Date | null): string | undefined {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  private async withAvailabilityWarnings<T extends Record<string, unknown>>(
    task: T,
    params: {
      projectId: string;
      ownerId?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      effortHours?: number | null;
      excludeTaskId?: string;
    },
  ): Promise<T & { warnings: string[] }> {
    if (!params.ownerId) {
      return { ...task, warnings: [] };
    }

    const availability = await this.projectTeamService.evaluateTaskAssigneeAvailability(
      params.projectId,
      {
        ownerId: params.ownerId,
        startDate: this.formatDateParam(params.startDate),
        endDate: this.formatDateParam(params.endDate),
        effortHours:
          params.effortHours != null ? Number(params.effortHours) : undefined,
        excludeTaskId: params.excludeTaskId,
      },
    );

    return { ...task, warnings: availability.warnings };
  }

  private validateTransition(oldStatus: TaskStatus, newStatus: TaskStatus) {
    if (oldStatus === newStatus) return;
    const allowed = LEGAL_TRANSITIONS[oldStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        status: HttpStatus.CONFLICT,
        errors: {
          status: `Illegal status transition from ${this.mapStatusToApi(oldStatus)} to ${this.mapStatusToApi(newStatus)}`,
        },
      });
    }
  }

  private validateStatusTransitionByRole(
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
    actorId: string,
    taskOwnerId: string | null,
    ability: AppAbility,
  ) {
    if (oldStatus === newStatus) {
      return;
    }

    this.validateTransition(oldStatus, newStatus);

    if (ability.can('approve', 'Task')) {
      return;
    }

    const isOwner = taskOwnerId === actorId;
    if (!isOwner) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { status: 'statusChangeNotPermitted' },
      });
    }

    const engineerAllowed: Record<TaskStatus, TaskStatus[]> = {
      To_Do: [TaskStatus.In_Progress],
      In_Progress: [TaskStatus.To_Do],
      Submitted_for_Review: [],
      Approved: [],
      Rework: [TaskStatus.In_Progress],
      Done: [],
    };

    const allowed = engineerAllowed[oldStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { status: 'statusChangeNotPermittedForRole' },
      });
    }
  }

  private async validateReferences(
    projectId: string,
    ownerId?: string | null,
    parentTaskId?: string | null,
    phaseId?: string | null,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { project: 'projectNotFound' },
      });
    }

    if (ownerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });
      if (!user) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { owner: 'ownerNotFound' },
        });
      }

      const teamAllocation = await this.prisma.allocation.findFirst({
        where: {
          projectId,
          status: 'Active',
          employee: {
            userId: ownerId,
            isActive: true,
          },
        },
      });

      if (!teamAllocation) {
        // DEF-P1-026 — project PMs may own tasks without a team allocation row.
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { primaryPmId: true, secondaryPmId: true },
        });
        const isProjectPm =
          project?.primaryPmId === ownerId ||
          project?.secondaryPmId === ownerId;
        if (!isProjectPm) {
          throw new UnprocessableEntityException({
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            errors: { ownerId: 'assigneeMustBeOnProjectTeam' },
          });
        }
      }
    }

    if (phaseId) {
      const phase = await this.prisma.projectPhase.findFirst({
        where: { id: phaseId, projectId },
      });
      if (!phase) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { phase: 'phaseNotFoundOrNotBelongToProject' },
        });
      }
    }

    if (parentTaskId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: parentTaskId },
      });
      if (!parent) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { parentTask: 'parentTaskNotFound' },
        });
      }
      if (parent.projectId !== projectId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { parentTask: 'parentTaskMustBeInSameProject' },
        });
      }
      if (parent.parentTaskId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { parentTask: 'subTasksCannotBeNestedDeeperThanOneLevel' },
        });
      }
    }
  }

  
  private toTaskDayKey(value: Date | string): string {
    if (typeof value === 'string') return value.slice(0, 10);
    // Prisma @db.Date values are UTC midnight — use UTC parts, not local.
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async assertTaskDatesWithinPhase(
    projectId: string,
    phaseId: string | null | undefined,
    startDate?: Date | string | null,
    endDate?: Date | string | null,
  ) {
    if (!phaseId) return;

    const phase = await this.prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
      select: { startDate: true, endDate: true },
    });
    if (!phase) return;

    const phaseStart = phase.startDate ? this.toTaskDayKey(phase.startDate) : null;
    const phaseEnd = phase.endDate ? this.toTaskDayKey(phase.endDate) : null;

    if (startDate) {
      const start = this.toTaskDayKey(startDate);
      if (phaseStart && start < phaseStart) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { startDate: 'taskStartDateOutsidePhase' },
          message:
            'Task start date must be on or after the phase start date',
        });
      }
      if (phaseEnd && start > phaseEnd) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { startDate: 'taskStartDateOutsidePhase' },
          message: 'Task start date must be on or before the phase end date',
        });
      }
    }

    if (endDate) {
      const end = this.toTaskDayKey(endDate);
      if (phaseEnd && end > phaseEnd) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { endDate: 'taskEndDateOutsidePhase' },
          message: 'Task end date must be on or before the phase end date',
        });
      }
      if (phaseStart && end < phaseStart) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { endDate: 'taskEndDateOutsidePhase' },
          message: 'Task end date must be on or after the phase start date',
        });
      }
    }
  }

  /** DEF-P1-013 — sub-task dates must stay within the parent task range. */
  private async assertTaskDatesWithinParent(
    parentTaskId: string | null | undefined,
    startDate?: Date | string | null,
    endDate?: Date | string | null,
  ) {
    if (!parentTaskId) return;

    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
      select: { startDate: true, endDate: true, title: true },
    });
    if (!parent) return;

    const parentStart = parent.startDate
      ? this.toTaskDayKey(parent.startDate)
      : null;
    const parentEnd = parent.endDate ? this.toTaskDayKey(parent.endDate) : null;
    if (!parentStart && !parentEnd) return;

    if (startDate) {
      const start = this.toTaskDayKey(startDate);
      if (parentStart && start < parentStart) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { startDate: 'taskStartDateOutsideParent' },
          message:
            'Sub-task start date must be on or after the parent task start date',
        });
      }
      if (parentEnd && start > parentEnd) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { startDate: 'taskStartDateOutsideParent' },
          message:
            'Sub-task start date must be on or before the parent task end date',
        });
      }
    }

    if (endDate) {
      const end = this.toTaskDayKey(endDate);
      if (parentEnd && end > parentEnd) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { endDate: 'taskEndDateOutsideParent' },
          message:
            'Sub-task end date must be on or before the parent task end date',
        });
      }
      if (parentStart && end < parentStart) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { endDate: 'taskEndDateOutsideParent' },
          message:
            'Sub-task end date must be on or after the parent task start date',
        });
      }
    }
  }

  async create(dto: CreateTaskDto, actorId: string, viewerRoleCode?: string) {
    await this.validateReferences(dto.projectId, dto.ownerId, dto.parentTaskId, dto.phaseId);
    await this.assertTaskDatesWithinPhase(
      dto.projectId,
      dto.phaseId,
      dto.startDate,
      dto.endDate,
    );
    await this.assertTaskDatesWithinParent(
      dto.parentTaskId,
      dto.startDate,
      dto.endDate,
    );

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        parentTaskId: dto.parentTaskId ?? null,
        phaseId: dto.phaseId,
        title: dto.title,
        description: dto.description ?? null,
        priority: (dto.priority as PriorityLevel) ?? PriorityLevel.Medium,
        ownerId: dto.ownerId ?? null,
        backupOwnerId: dto.backupOwnerId ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        effortHours: dto.effortHours ?? null,
        status: dto.status ? this.mapStatusToPrisma(dto.status) : TaskStatus.To_Do,
      },
      include: TASK_INCLUDE,
    });

    const formatted = this.formatTask(task, viewerRoleCode);
    await this.notifyTaskAssigned(task, actorId);
    return this.withAvailabilityWarnings(formatted, {
      projectId: dto.projectId,
      ownerId: dto.ownerId,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      effortHours: dto.effortHours ?? null,
    });
  }

  async createBundle(
    dto: CreateTaskBundleDto,
    files: Express.Multer.File[],
    actorId: string,
    viewerRoleCode?: string,
  ) {
    await this.validateReferences(dto.projectId, dto.ownerId, dto.parentTaskId, dto.phaseId);
    await this.assertTaskDatesWithinPhase(
      dto.projectId,
      dto.phaseId,
      dto.startDate,
      dto.endDate,
    );
    await this.assertTaskDatesWithinParent(
      dto.parentTaskId,
      dto.startDate,
      dto.endDate,
    );

    const comments = dto.comments ?? [];
    for (const comment of comments) {
      const isInternal = comment.isInternal ?? true;
      if (this.isExternalRole(viewerRoleCode) && isInternal) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { isInternal: 'externalUsersCannotPostInternalComments' },
        });
      }
    }

    if (files.length > TASK_ATTACHMENT_MAX_FILES) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { attachment: 'attachmentLimitExceeded' },
      });
    }

    const subTasks = dto.parentTaskId ? [] : (dto.subTasks ?? []);

    const uploadedFiles: UploadedFileResult[] = [];
    for (const file of files) {
      uploadedFiles.push(await this.filesUploadService.upload(file));
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: dto.projectId,
          parentTaskId: dto.parentTaskId ?? null,
          phaseId: dto.phaseId,
          title: dto.title,
          description: dto.description ?? null,
          priority: (dto.priority as PriorityLevel) ?? PriorityLevel.Medium,
          ownerId: dto.ownerId ?? null,
          startDate: dto.startDate ?? null,
          endDate: dto.endDate ?? null,
          effortHours: dto.effortHours ?? null,
          status: dto.status ? this.mapStatusToPrisma(dto.status) : TaskStatus.To_Do,
        },
      });

      for (const sub of subTasks) {
        await tx.task.create({
          data: {
            projectId: dto.projectId,
            parentTaskId: created.id,
            phaseId: dto.phaseId,
            title: sub.title,
            description: sub.description ?? null,
            priority: PriorityLevel.Medium,
            status: TaskStatus.To_Do,
            startDate: dto.startDate ?? null,
            endDate: dto.endDate ?? null,
            effortHours: dto.effortHours ?? 1,
          },
        });
      }

      for (const comment of comments) {
        await tx.taskComment.create({
          data: {
            taskId: created.id,
            authorId: actorId,
            body: comment.body.trim(),
            isInternal: comment.isInternal ?? true,
          },
        });
      }

      const checklistItems = dto.checklistItems ?? [];
      let sortOrder = 0;
      for (const item of checklistItems) {
        const title = item.title?.trim();
        if (!title) continue;
        await tx.taskChecklistItem.create({
          data: {
            taskId: created.id,
            title,
            isDone: item.isDone ?? false,
            sortOrder: sortOrder++,
          },
        });
      }

      for (const uploaded of uploadedFiles) {
        await this.workspaceDocumentsService.createForTask(
          { id: created.id, projectId: dto.projectId },
          {
            storageKey: uploaded.storageKey,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
          actorId,
          tx,
        );
      }

      return tx.task.findUnique({
        where: { id: created.id },
        include: TASK_INCLUDE,
      });
    });

    if (!task) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { task: 'taskCreationFailed' },
      });
    }

    await this.notifyTaskAssigned(task, actorId);
    return this.withAvailabilityWarnings(this.formatTask(task, viewerRoleCode), {
      projectId: dto.projectId,
      ownerId: dto.ownerId,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      effortHours: dto.effortHours ?? null,
    });
  }

  async updateBundle(
    id: string,
    dto: UpdateTaskBundleDto,
    files: Express.Multer.File[],
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const existing = await this.prisma.task.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.taskWhere(caslUser, 'update')],
      },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    const comments = dto.comments ?? [];
    for (const comment of comments) {
      const isInternal = comment.isInternal ?? true;
      if (this.isExternalRole(viewerRoleCode) && isInternal) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { isInternal: 'externalUsersCannotPostInternalComments' },
        });
      }
    }

    const subTasks = existing.parentTaskId ? [] : (dto.subTasks ?? []);
    const removeAttachmentIds = dto.removeAttachmentIds ?? [];
    const addDependencies = dto.addDependencies ?? [];
    const removeDependencyIds = dto.removeDependencyIds ?? [];

    await this.taskDependenciesService.validateBundleChanges(
      addDependencies,
      removeDependencyIds,
      caslUser,
      ability,
    );

    const projectId = dto.projectId ?? existing.projectId;
    const ownerId = dto.ownerId !== undefined ? dto.ownerId : existing.ownerId;
    const parentTaskId =
      dto.parentTaskId !== undefined ? dto.parentTaskId : existing.parentTaskId;
    const phaseId = dto.phaseId !== undefined ? dto.phaseId : existing.phaseId;

    if (dto.projectId || dto.ownerId !== undefined || dto.parentTaskId !== undefined || dto.phaseId !== undefined) {
      await this.validateReferences(projectId, ownerId, parentTaskId, phaseId);
    }

    const resolvedPhaseId =
      dto.phaseId !== undefined ? dto.phaseId : existing.phaseId;
    const resolvedStartDate =
      dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const resolvedEndDate =
      dto.endDate !== undefined ? dto.endDate : existing.endDate;

    if (
      dto.phaseId !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined
    ) {
      await this.assertTaskDatesWithinPhase(
        projectId,
        resolvedPhaseId,
        resolvedStartDate,
        resolvedEndDate,
      );
    }

    if (
      parentTaskId &&
      (dto.startDate !== undefined ||
        dto.endDate !== undefined ||
        dto.parentTaskId !== undefined)
    ) {
      await this.assertTaskDatesWithinParent(
        parentTaskId,
        resolvedStartDate,
        resolvedEndDate,
      );
    }

    if (dto.status) {
      const nextStatus = this.mapStatusToPrisma(dto.status);
      this.validateStatusTransitionByRole(
        existing.status,
        nextStatus,
        actorId,
        ownerId,
        ability,
      );
    }

    if (files.length > 0 || removeAttachmentIds.length > 0) {
      const existingAttachmentCount = await this.prisma.workspaceDocument.count({
        where: { taskId: id, category: 'Task' },
      });
      const remainingAfterRemove = Math.max(
        0,
        existingAttachmentCount - removeAttachmentIds.length,
      );
      if (remainingAfterRemove + files.length > TASK_ATTACHMENT_MAX_FILES) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { attachment: 'attachmentLimitExceeded' },
        });
      }
    }

    const uploadedFiles: UploadedFileResult[] = [];
    for (const file of files) {
      uploadedFiles.push(await this.filesUploadService.upload(file));
    }

    const impactedSuccessorIds = new Set<string>();

    const task = await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          description: dto.description ?? undefined,
          priority: (dto.priority as PriorityLevel) ?? undefined,
          ownerId: dto.ownerId !== undefined ? dto.ownerId : undefined,
          phaseId: dto.phaseId !== undefined ? dto.phaseId : undefined,
          startDate: dto.startDate !== undefined ? dto.startDate : undefined,
          endDate: dto.endDate !== undefined ? dto.endDate : undefined,
          effortHours: dto.effortHours !== undefined ? dto.effortHours : undefined,
          status: dto.status ? this.mapStatusToPrisma(dto.status) : undefined,
        },
      });

      for (const sub of subTasks) {
        const parentEffort =
          existing.effortHours != null
            ? Number(existing.effortHours)
            : dto.effortHours != null
              ? Number(dto.effortHours)
              : 1;
        await tx.task.create({
          data: {
            projectId: existing.projectId,
            parentTaskId: id,
            phaseId: resolvedPhaseId,
            title: sub.title,
            description: sub.description ?? null,
            priority: PriorityLevel.Medium,
            status: TaskStatus.To_Do,
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            effortHours: Number.isFinite(parentEffort) && parentEffort > 0
              ? Math.floor(parentEffort)
              : 1,
          },
        });
      }

      for (const comment of comments) {
        await tx.taskComment.create({
          data: {
            taskId: id,
            authorId: actorId,
            body: comment.body.trim(),
            isInternal: comment.isInternal ?? true,
          },
        });
      }

      if (removeAttachmentIds.length) {
        await tx.workspaceDocument.deleteMany({
          where: {
            id: { in: removeAttachmentIds },
            taskId: id,
            category: 'Task',
          },
        });
      }

      for (const uploaded of uploadedFiles) {
        await this.workspaceDocumentsService.createForTask(
          { id, projectId: existing.projectId },
          {
            storageKey: uploaded.storageKey,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
          actorId,
          tx,
        );
      }

      if (removeDependencyIds.length) {
        const deps = await tx.taskDependency.findMany({
          where: {
            id: { in: removeDependencyIds },
            OR: [{ predecessorId: id }, { successorId: id }],
          },
        });
        for (const dep of deps) {
          impactedSuccessorIds.add(dep.successorId);
        }
        await tx.taskDependency.deleteMany({
          where: { id: { in: deps.map((dep) => dep.id) } },
        });
      }

      const uniqueAdds = new Map<
        string,
        (typeof addDependencies)[number]
      >();
      for (const dep of addDependencies) {
        uniqueAdds.set(`${dep.predecessorId}:${dep.successorId}`, dep);
      }

      for (const dep of uniqueAdds.values()) {
        const depType = dep.depType ?? 'FS';
        const lagDays = dep.lagDays ?? 0;
        const existingDep = await tx.taskDependency.findUnique({
          where: {
            predecessorId_successorId: {
              predecessorId: dep.predecessorId,
              successorId: dep.successorId,
            },
          },
        });

        if (existingDep) {
          if (
            existingDep.depType !== depType ||
            existingDep.lagDays !== lagDays
          ) {
            await tx.taskDependency.update({
              where: { id: existingDep.id },
              data: { depType, lagDays },
            });
          }
        } else {
          await tx.taskDependency.create({
            data: {
              predecessorId: dep.predecessorId,
              successorId: dep.successorId,
              depType,
              lagDays,
            },
          });
        }
        impactedSuccessorIds.add(dep.successorId);
      }

      return tx.task.findFirst({
        where: { id },
        include: TASK_INCLUDE,
      });
    });

    if (!task) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { task: 'taskUpdateFailed' },
      });
    }

    await this.dispatchTaskUpdateNotifications(existing, task, actorId);

    const startChanged =
      dto.startDate !== undefined &&
      (existing.startDate?.getTime() ?? null) !== (task.startDate?.getTime() ?? null);
    const endChanged =
      dto.endDate !== undefined &&
      (existing.endDate?.getTime() ?? null) !== (task.endDate?.getTime() ?? null);

    if (startChanged || endChanged) {
      await this.taskDependenciesService.recalculateFromTaskDateChange(
        task.projectId,
        task.id,
        actorId,
        task.title,
      );
    } else if (impactedSuccessorIds.size > 0) {
      await this.taskDependenciesService.recalculateFromTaskDateChange(
        task.projectId,
        Array.from(impactedSuccessorIds)[0],
        actorId,
        task.title,
      );
    }

    return this.withAvailabilityWarnings(this.formatTask(task, viewerRoleCode), {
      projectId: task.projectId,
      ownerId: task.ownerId,
      startDate: task.startDate,
      endDate: task.endDate,
      effortHours: task.effortHours != null ? Number(task.effortHours) : null,
      excludeTaskId: task.id,
    });
  }

  async findManyWithPagination(
    query: QueryTaskDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildTaskListWhere(query, caslUser);

    const tasks = await this.prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: TASK_INCLUDE,
    });

    const formatted = await Promise.all(
      tasks.map(async (task) =>
        this.attachScheduleImpact(this.formatTask(task, viewerRoleCode)),
      ),
    );

    return this.attachEffortVarianceMany(formatted);
  }

  async countMany(query: QueryTaskDto, caslUser: CaslUserContext) {
    return this.prisma.task.count({
      where: this.buildTaskListWhere(query, caslUser),
    });
  }

  async getActiveTaskStats(caslUser: CaslUserContext) {
    const baseWhere: Prisma.TaskWhereInput = {
      AND: [
        this.recordScopeWhere.taskWhere(caslUser, 'read'),
        { parentTaskId: null },
      ],
    };

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [statusGroups, overdue] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          AND: [
            baseWhere,
            {
              endDate: { lt: endOfToday },
              status: { notIn: [TaskStatus.Done, TaskStatus.Approved] },
            },
          ],
        },
      }),
    ]);

    const byStatus = new Map(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    const todo = byStatus.get(TaskStatus.To_Do) ?? 0;
    const inProgress =
      (byStatus.get(TaskStatus.In_Progress) ?? 0) +
      (byStatus.get(TaskStatus.Submitted_for_Review) ?? 0);
    const rework = byStatus.get(TaskStatus.Rework) ?? 0;
    const done =
      (byStatus.get(TaskStatus.Done) ?? 0) +
      (byStatus.get(TaskStatus.Approved) ?? 0);
    const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);

    return { total, todo, inProgress, rework, done, overdue };
  }

  private buildTaskListWhere(
    query: QueryTaskDto,
    caslUser: CaslUserContext,
  ): Prisma.TaskWhereInput {
    const filters: Prisma.TaskWhereInput[] = [
      this.recordScopeWhere.taskWhere(caslUser, 'read'),
    ];

    if (query.projectId) {
      filters.push({ projectId: query.projectId });
    }
    if (query.ownerId) {
      filters.push({ ownerId: query.ownerId });
    }
    if (query.status) {
      filters.push({ status: this.mapStatusToPrisma(query.status) });
    }
    if (query.priority) {
      filters.push({ priority: query.priority });
    }
    if (query.parentTaskId) {
      filters.push({ parentTaskId: query.parentTaskId });
    } else if (query.topLevelOnly !== false) {
      filters.push({ parentTaskId: null });
    }
    if (query.phaseId) {
      filters.push({ phaseId: query.phaseId });
    }
    if (query.search) {
      filters.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return { AND: filters };
  }

  async findManyForExport(
    query: QueryTaskDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const where = this.buildTaskListWhere(query, caslUser);

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: TASK_INCLUDE,
    });

    return tasks.map((task) => this.formatTask(task, viewerRoleCode));
  }

  async findById(
    id: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.taskWhere(caslUser, 'read')],
      },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    return this.attachEffortVariance(
      await this.attachScheduleImpact(this.formatTask(task, viewerRoleCode)),
    );
  }

  async bulk(
    dto: BulkTasksDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const uniqueIds = [...new Set(dto.taskIds)];

    if (dto.delete) {
      let deleted = 0;
      for (const id of uniqueIds) {
        await this.remove(id, actorId, caslUser, ability);
        deleted += 1;
      }
      return { deleted, updated: 0 };
    }

    const patch: UpdateTaskDto = {};
    if (dto.ownerId !== undefined) {
      patch.ownerId = dto.ownerId;
    }
    if (dto.status !== undefined) {
      patch.status = dto.status;
    }
    if (dto.priority !== undefined) {
      patch.priority = dto.priority;
    }

    let updatedCount = 0;
    for (const id of uniqueIds) {
      await this.update(id, patch, actorId, caslUser, ability, viewerRoleCode);
      updatedCount += 1;
    }
    return { deleted: 0, updated: updatedCount };
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const existing = await this.prisma.task.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.taskWhere(caslUser, 'update')],
      },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    const projectId = dto.projectId ?? existing.projectId;
    const ownerId = dto.ownerId !== undefined ? dto.ownerId : existing.ownerId;
    const parentTaskId =
      dto.parentTaskId !== undefined ? dto.parentTaskId : existing.parentTaskId;
    const phaseId = dto.phaseId !== undefined ? dto.phaseId : existing.phaseId;

    if (dto.projectId || dto.ownerId || dto.parentTaskId || dto.phaseId !== undefined) {
      await this.validateReferences(projectId, ownerId, parentTaskId, phaseId);
    }

    const resolvedStartDate =
      dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const resolvedEndDate =
      dto.endDate !== undefined ? dto.endDate : existing.endDate;

    if (
      dto.phaseId !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined
    ) {
      await this.assertTaskDatesWithinPhase(
        projectId,
        phaseId,
        resolvedStartDate,
        resolvedEndDate,
      );
    }

    if (
      parentTaskId &&
      (dto.startDate !== undefined ||
        dto.endDate !== undefined ||
        dto.parentTaskId !== undefined)
    ) {
      await this.assertTaskDatesWithinParent(
        parentTaskId,
        resolvedStartDate,
        resolvedEndDate,
      );
    }

    if (dto.status) {
      const nextStatus = this.mapStatusToPrisma(dto.status);
      this.validateStatusTransitionByRole(
        existing.status,
        nextStatus,
        actorId,
        ownerId,
        ability,
      );
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        priority: (dto.priority as PriorityLevel) ?? undefined,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : undefined,
        backupOwnerId:
          dto.backupOwnerId !== undefined ? dto.backupOwnerId : undefined,
        phaseId: dto.phaseId !== undefined ? dto.phaseId : undefined,
        startDate: dto.startDate !== undefined ? dto.startDate : undefined,
        endDate: dto.endDate !== undefined ? dto.endDate : undefined,
        effortHours: dto.effortHours !== undefined ? dto.effortHours : undefined,
        status: dto.status ? this.mapStatusToPrisma(dto.status) : undefined,
      },
      include: TASK_INCLUDE,
    });

    await this.dispatchTaskUpdateNotifications(existing, task, actorId);

    const startChanged =
      dto.startDate !== undefined &&
      (existing.startDate?.getTime() ?? null) !== (task.startDate?.getTime() ?? null);
    const endChanged =
      dto.endDate !== undefined &&
      (existing.endDate?.getTime() ?? null) !== (task.endDate?.getTime() ?? null);

    if (startChanged || endChanged) {
      await this.taskDependenciesService.recalculateFromTaskDateChange(
        task.projectId,
        task.id,
        actorId,
        task.title,
      );
    }

    const resultTask =
      startChanged || endChanged
        ? ((await this.prisma.task.findFirst({
            where: { id },
            include: TASK_INCLUDE,
          })) ?? task)
        : task;

    return this.withAvailabilityWarnings(this.formatTask(resultTask, viewerRoleCode), {
      projectId: resultTask.projectId,
      ownerId: resultTask.ownerId,
      startDate: resultTask.startDate,
      endDate: resultTask.endDate,
      effortHours: task.effortHours != null ? Number(task.effortHours) : null,
      excludeTaskId: resultTask.id,
    });
  }

  async remove(id: string, actorId: string, caslUser: CaslUserContext, ability: AppAbility) {
    const existing = await this.prisma.task.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.taskWhere(caslUser, 'update')],
      },
      include: { subTasks: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    if (existing.subTasks.length > 0) {
      throw new ConflictException({
        status: HttpStatus.CONFLICT,
        errors: { task: 'cannotDeleteTaskWithSubTasks' },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taskChecklistItem.deleteMany({ where: { taskId: id } });
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      await tx.workspaceDocument.deleteMany({
        where: { taskId: id, category: 'Task' },
      });
      await tx.task.delete({ where: { id } });
    });
  }

  private mapChecklistItem(item: {
    id: string;
    taskId: string;
    title: string;
    isDone: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      taskId: item.taskId,
      title: item.title,
      isDone: item.isDone,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async getChecklist(
    taskId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const items = await this.prisma.taskChecklistItem.findMany({
      where: { taskId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const mapped = items.map((item) => this.mapChecklistItem(item));
    const done = mapped.filter((item) => item.isDone).length;
    const total = mapped.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    return { total, done, percent, items: mapped };
  }

  async addChecklistItem(
    taskId: string,
    dto: CreateTaskChecklistItemDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const title = dto.title.trim();
    if (!title) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { title: 'titleRequired' },
      });
    }

    const maxOrder = await this.prisma.taskChecklistItem.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.taskChecklistItem.create({
      data: {
        taskId,
        title,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return this.mapChecklistItem(item);
  }

  async updateChecklistItem(
    taskId: string,
    itemId: string,
    dto: UpdateTaskChecklistItemDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const existing = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
    });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { checklistItem: 'checklistItemNotFound' },
      });
    }

    const title =
      dto.title !== undefined ? dto.title.trim() : undefined;
    if (dto.title !== undefined && !title) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { title: 'titleRequired' },
      });
    }

    const item = await this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(title !== undefined && { title }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
      },
    });

    return this.mapChecklistItem(item);
  }

  async removeChecklistItem(
    taskId: string,
    itemId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const existing = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { checklistItem: 'checklistItemNotFound' },
      });
    }

    await this.prisma.taskChecklistItem.delete({ where: { id: itemId } });
  }

  async getComments(
    taskId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.filterCommentsForRole(comments, viewerRoleCode);
  }

  async addComment(
    taskId: string,
    dto: CreateTaskCommentDto,
    authorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const isInternal = dto.isInternal ?? true;
    if (this.isExternalRole(viewerRoleCode) && isInternal) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { isInternal: 'externalUsersCannotPostInternalComments' },
      });
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        body: dto.body.trim(),
        isInternal,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    return comment;
  }

  async updateComment(
    taskId: string,
    commentId: string,
    dto: UpdateTaskCommentDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const existing = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { comment: 'commentNotFound' },
      });
    }

    if (existing.authorId !== actorId && !ability.can('update', 'Task')) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { comment: 'cannotEditComment' },
      });
    }

    const isInternal = dto.isInternal ?? existing.isInternal;
    if (this.isExternalRole(viewerRoleCode) && isInternal) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { isInternal: 'externalUsersCannotPostInternalComments' },
      });
    }

    return this.prisma.taskComment.update({
      where: { id: commentId },
      data: {
        body: dto.body.trim(),
        isInternal,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async removeComment(
    taskId: string,
    commentId: string,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const existing = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { comment: 'commentNotFound' },
      });
    }

    if (existing.authorId !== actorId && !ability.can('update', 'Task')) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { comment: 'cannotDeleteComment' },
      });
    }

    await this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  async getAttachments(
    taskId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);
    return this.workspaceDocumentsService.listForTask(taskId);
  }

  async addAttachment(
    taskId: string,
    dto: CreateTaskAttachmentDto,
    uploaderId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const task = await this.findById(taskId, caslUser, ability, viewerRoleCode);

    return this.workspaceDocumentsService.createForTask(
      { id: task.id, projectId: task.projectId },
      {
        storageKey: dto.storageKey,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
      uploaderId,
    );
  }

  async removeAttachment(
    taskId: string,
    attachmentId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);
    await this.workspaceDocumentsService.removeForTask(taskId, attachmentId);
  }

  private buildTaskPayload(task: {
    id: string;
    projectId: string;
    title: string;
    project?: { name?: string | null } | null;
  }) {
    return {
      taskId: task.id,
      projectId: task.projectId,
      projectName: task.project?.name ?? null,
      taskTitle: task.title,
      link: `/dashboard/projects/${task.projectId}?taskId=${encodeURIComponent(task.id)}`,
    };
  }

  private async notifyTaskAssigned(
    task: {
      id: string;
      projectId: string;
      title: string;
      ownerId: string | null;
      project?: { name?: string | null } | null;
    },
    actorId: string,
  ): Promise<void> {
    if (!task.ownerId) {
      return;
    }

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.TASK_ASSIGNED,
      recipientUserIds: [task.ownerId],
      title: 'Task assigned',
      body: `You were assigned to "${task.title}"${
        task.project?.name ? ` on ${task.project.name}` : ''
      }.`,
      payload: this.buildTaskPayload(task),
      sourceObjectType: 'Task',
      sourceObjectId: task.id,
      actorId,
      // DEF-P1-026 follow-up: PM self-assign should still notify.
      includeActorAsRecipient: true,
    });
  }

  private async dispatchTaskUpdateNotifications(
    before: {
      ownerId: string | null;
      title: string;
      priority: PriorityLevel;
      status: TaskStatus;
      startDate: Date | null;
      endDate: Date | null;
    },
    after: {
      id: string;
      projectId: string;
      title: string;
      ownerId: string | null;
      priority: PriorityLevel;
      status: TaskStatus;
      startDate: Date | null;
      endDate: Date | null;
      project?: { name?: string | null } | null;
    },
    actorId: string,
  ): Promise<void> {
    if (before.ownerId !== after.ownerId && after.ownerId) {
      await this.notifyTaskAssigned(after, actorId);
      return;
    }

    if (!after.ownerId) {
      return;
    }

    const keyFieldChanged =
      before.title !== after.title ||
      before.priority !== after.priority ||
      before.status !== after.status ||
      before.startDate?.toISOString() !== after.startDate?.toISOString() ||
      before.endDate?.toISOString() !== after.endDate?.toISOString();

    if (!keyFieldChanged) {
      return;
    }

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.TASK_UPDATED,
      recipientUserIds: [after.ownerId],
      title: 'Task updated',
      body: `"${after.title}" was updated${
        after.project?.name ? ` on ${after.project.name}` : ''
      }.`,
      payload: this.buildTaskPayload(after),
      sourceObjectType: 'Task',
      sourceObjectId: after.id,
      actorId,
    });
  }
}
