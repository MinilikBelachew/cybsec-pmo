import {
  ConflictException,
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
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { CreateTaskBundleDto } from './dto/create-task-bundle.dto';
import { FilesUploadService, UploadedFileResult } from '../files/files-upload.service';
import { TaskStatus, PriorityLevel } from '@prisma/client';
import { RoleEnum } from '../roles/roles.enum';

const EXTERNAL_ROLES = [RoleEnum.client, RoleEnum.vendor];

const TASK_INCLUDE = {
  project: { select: { id: true, name: true } },
  owner: { select: { id: true, displayName: true, email: true } },
  parentTask: { select: { id: true, title: true } },
  subTasks: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      owner: { select: { id: true, displayName: true, email: true } },
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
  attachments: {
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

  private mapAttachment(attachment: {
    id: string;
    taskId: string;
    uploadedBy: string;
    s3Key: string;
    filename: string;
    mimeType: string | null;
    sizeBytes: bigint | null;
    createdAt: Date;
    uploader: { id: string; displayName: string; email: string };
  }) {
    return {
      ...attachment,
      sizeBytes: attachment.sizeBytes != null ? Number(attachment.sizeBytes) : null,
      url: this.resolveStorageUrl(attachment.s3Key),
    };
  }

  private resolveStorageUrl(storageKey: string): string {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return storageKey;
    }
    if (storageKey.startsWith('/')) {
      const backendDomain =
        process.env.BACKEND_DOMAIN?.replace(/\/$/, '') ?? 'http://localhost:6001';
      return `${backendDomain}${storageKey}`;
    }
    return storageKey;
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
    const { comments, attachments, ...rest } = task as any;
    return {
      ...rest,
      comments: this.filterCommentsForRole(comments ?? [], roleCode),
      attachments: (attachments ?? []).map((a: any) => this.mapAttachment(a)),
    };
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

  private async validateReferences(
    projectId: string,
    ownerId?: string | null,
    parentTaskId?: string | null,
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

  async create(dto: CreateTaskDto, actorId: string, viewerRoleCode?: string) {
    await this.validateReferences(dto.projectId, dto.ownerId, dto.parentTaskId);

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        parentTaskId: dto.parentTaskId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        priority: (dto.priority as PriorityLevel) ?? PriorityLevel.Medium,
        ownerId: dto.ownerId ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        effortHours: dto.effortHours ?? null,
        status: dto.status ? this.mapStatusToPrisma(dto.status) : TaskStatus.To_Do,
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(task, viewerRoleCode);
  }

  async createBundle(
    dto: CreateTaskBundleDto,
    files: Express.Multer.File[],
    actorId: string,
    viewerRoleCode?: string,
  ) {
    await this.validateReferences(dto.projectId, dto.ownerId, dto.parentTaskId);

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
            title: sub.title,
            description: sub.description ?? null,
            priority: PriorityLevel.Medium,
            status: TaskStatus.To_Do,
            startDate: dto.startDate ?? null,
            endDate: dto.endDate ?? null,
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

      for (const uploaded of uploadedFiles) {
        await tx.taskAttachment.create({
          data: {
            taskId: created.id,
            uploadedBy: actorId,
            s3Key: uploaded.storageKey,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType ?? null,
            sizeBytes: uploaded.sizeBytes != null ? BigInt(uploaded.sizeBytes) : null,
          },
        });
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

    return this.formatTask(task, viewerRoleCode);
  }

  async findManyWithPagination(
    query: QueryTaskDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filters: Record<string, unknown>[] = [
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
    if (query.search) {
      filters.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const where = { AND: filters };

    const tasks = await this.prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
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

    return this.formatTask(task, viewerRoleCode);
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

    if (dto.projectId || dto.ownerId || dto.parentTaskId) {
      await this.validateReferences(projectId, ownerId, parentTaskId);
    }

    if (dto.status) {
      const nextStatus = this.mapStatusToPrisma(dto.status);
      this.validateTransition(existing.status, nextStatus);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        priority: (dto.priority as PriorityLevel) ?? undefined,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : undefined,
        startDate: dto.startDate !== undefined ? dto.startDate : undefined,
        endDate: dto.endDate !== undefined ? dto.endDate : undefined,
        effortHours: dto.effortHours !== undefined ? dto.effortHours : undefined,
        status: dto.status ? this.mapStatusToPrisma(dto.status) : undefined,
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(task, viewerRoleCode);
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
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      await tx.taskAttachment.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });
    });
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

  async getAttachments(
    taskId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((a) => this.mapAttachment(a));
  }

  async addAttachment(
    taskId: string,
    dto: CreateTaskAttachmentDto,
    uploaderId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedBy: uploaderId,
        s3Key: dto.storageKey,
        filename: dto.filename,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes != null ? BigInt(dto.sizeBytes) : null,
      },
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
    });

    return this.mapAttachment(attachment);
  }

  async removeAttachment(
    taskId: string,
    attachmentId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
    viewerRoleCode?: string,
  ) {
    await this.findById(taskId, caslUser, ability, viewerRoleCode);

    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
    });

    if (!attachment) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { attachment: 'attachmentNotFound' },
      });
    }

    await this.prisma.taskAttachment.delete({ where: { id: attachmentId } });
  }
}
