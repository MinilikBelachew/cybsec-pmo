import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildProjectAuditLogWhere } from './audit-log-project-query.util';
import { buildAuditLogOrderBy, buildAuditLogWhere } from './audit-log-query.util';
import { generateAuditDescription } from './audit-description.helper';
import { QueryAuditDto } from './dto/query-audit.dto';
import { QueryProjectAuditDto } from './dto/query-project-audit.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AuditLogCreateInput) {
    const description =
      data.description ??
      generateAuditDescription({
        action: data.action,
        objectType: data.objectType,
        objectId:
          typeof data.objectId === 'string'
            ? data.objectId
            : ((data.objectId as { set?: string | null } | undefined)?.set ??
              null),
        oldValue: data.oldValue === Prisma.DbNull ? null : data.oldValue,
        newValue: data.newValue === Prisma.DbNull ? null : data.newValue,
      });

    return this.prisma.auditLog.create({
      data: {
        ...data,
        description,
      },
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

  async findOne(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
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

    if (!row) {
      throw new NotFoundException({
        status: 404,
        errors: { eventId: 'auditEventNotFound' },
      });
    }

    return row;
  }

  async count(where?: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where });
  }

  async findForProject(projectId: string, query: QueryProjectAuditDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const projectScope = await buildProjectAuditLogWhere(this.prisma, projectId);
    const filters = buildAuditLogWhere(query as QueryAuditDto);
    const filterClauses = Object.keys(filters).length > 0 ? [filters] : [];

    const where: Prisma.AuditLogWhereInput = {
      AND: [projectScope, ...filterClauses],
    };
    const orderBy = buildAuditLogOrderBy(query as QueryAuditDto);

    const [data, total] = await Promise.all([
      this.findAll({ where, skip, take: limit, orderBy }),
      this.count(where),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
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
