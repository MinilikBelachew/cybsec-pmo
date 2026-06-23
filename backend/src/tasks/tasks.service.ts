import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto, TaskStatusEnum } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { TaskStatus, PriorityLevel } from '@prisma/client';

const TASK_INCLUDE = {
  project: { select: { id: true, name: true } },
  owner: { select: { id: true, displayName: true, email: true } },
  parentTask: { select: { id: true, title: true } },
  subTasks: { select: { id: true, title: true, status: true } },
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

// Transition Map according to implementation guide:
// - To_Do <=> In_Progress
// - In_Progress -> Submitted_for_Review
// - Submitted_for_Review -> Approved | Rework
// - Rework -> In_Progress | Submitted_for_Review
// - Approved -> Done
const LEGAL_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  To_Do: [TaskStatus.In_Progress],
  In_Progress: [TaskStatus.To_Do, TaskStatus.Submitted_for_Review],
  Submitted_for_Review: [TaskStatus.Approved, TaskStatus.Rework],
  Approved: [TaskStatus.Done],
  Rework: [TaskStatus.In_Progress, TaskStatus.Submitted_for_Review],
  Done: [], // Done is terminal or can transition back only via PM action (keep simple for now)
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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
    // 1. Verify Project
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { project: 'projectNotFound' },
      });
    }

    // 2. Verify Owner/Assignee
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

    // 3. Verify Parent Task
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
    }
  }

  async create(dto: CreateTaskDto, actorId: string) {
    await this.validateReferences(dto.projectId, dto.ownerId, dto.parentTaskId);

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
        include: TASK_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CREATE_TASK',
          objectType: 'Task',
          objectId: created.id,
          newValue: {
            taskId: created.id,
            title: created.title,
            status: created.status,
          },
        },
      });

      return created;
    });

    return task;
  }

  async findManyWithPagination(query: QueryTaskDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: any = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.ownerId) {
      where.ownerId = query.ownerId;
    }
    if (query.status) {
      where.status = this.mapStatusToPrisma(query.status);
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: TASK_INCLUDE,
    });

    return tasks;
  }

  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    // Validate references if they change
    const projectId = dto.projectId ?? existing.projectId;
    const ownerId = dto.ownerId !== undefined ? dto.ownerId : existing.ownerId;
    const parentTaskId = dto.parentTaskId !== undefined ? dto.parentTaskId : existing.parentTaskId;
    
    if (dto.projectId || dto.ownerId || dto.parentTaskId) {
      await this.validateReferences(projectId, ownerId, parentTaskId);
    }

    // Validate transition if status changes
    if (dto.status) {
      const nextStatus = this.mapStatusToPrisma(dto.status);
      this.validateTransition(existing.status, nextStatus);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
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

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE_TASK',
          objectType: 'Task',
          objectId: updated.id,
          oldValue: {
            status: existing.status,
            title: existing.title,
          },
          newValue: {
            status: updated.status,
            title: updated.title,
          },
        },
      });

      return updated;
    });

    return task;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete any comments and attachments first
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      await tx.taskAttachment.deleteMany({ where: { taskId: id } });

      await tx.task.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DELETE_TASK',
          objectType: 'Task',
          objectId: id,
          oldValue: {
            title: existing.title,
          },
        },
      });
    });
  }

  // --- Comments ---
  async addComment(taskId: string, body: string, isInternal: boolean, authorId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        body,
        isInternal,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });
  }
}
