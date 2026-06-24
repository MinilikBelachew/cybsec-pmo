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
            roleCode: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where });
  }
}
