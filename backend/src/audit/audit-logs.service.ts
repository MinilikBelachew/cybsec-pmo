import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AuditLogCreateInput) {
    return this.prisma.auditLog.create({
      data,
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.AuditLogWhereUniqueInput;
    where?: Prisma.AuditLogWhereInput;
    orderBy?: Prisma.AuditLogOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.auditLog.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            role: { select: { id: true, code: true, label: true } },
          },
        },
      },
    });
  }

  async count(where?: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where });
  }

  async logStatusChange(params: {
    actorId: string | null;
    objectType: 'Project' | 'Task';
    objectId: string;
    fromStatus: string;
    toStatus: string;
    ipAddress?: string | null;
    isExternal?: boolean;
    breakGlassAction?: boolean;
    source?: string;
    context?: Record<string, unknown>;
  }) {
    const action =
      params.objectType === 'Project'
        ? 'PROJECT_STATUS_CHANGED'
        : 'TASK_STATUS_CHANGED';

    return this.create({
      action,
      objectType: params.objectType,
      objectId: params.objectId,
      oldValue: { status: params.fromStatus },
      newValue: {
        status: params.toStatus,
        statusTransition: { from: params.fromStatus, to: params.toStatus },
        ...(params.context ?? {}),
      },
      ipAddress: params.ipAddress ?? null,
      isExternal: params.isExternal ?? false,
      breakGlassAction: params.breakGlassAction ?? false,
      source: params.source ?? 'WebAPI',
      user: params.actorId ? { connect: { id: params.actorId } } : undefined,
    });
  }
}
