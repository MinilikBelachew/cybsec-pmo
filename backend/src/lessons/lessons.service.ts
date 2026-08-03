import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import {
  CreateLessonDto,
  LessonDto,
  UpdateLessonDto,
} from './dto/lesson.dto';

type LessonRow = Prisma.LessonsLearnedGetPayload<{
  include: {
    author: { select: { id: true; displayName: true; email: true } };
    project: { select: { id: true; name: true; departmentId: true } };
  };
}>;

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async list(
    caslUser: CaslUserContext,
    filters?: {
      category?: string;
      projectId?: string;
      q?: string;
      tag?: string;
    },
  ): Promise<LessonDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const q = filters?.q?.trim();

    const rows = await this.prisma.lessonsLearned.findMany({
      where: {
        AND: [
          {
            OR: [
              { projectId: null },
              { project: { AND: [scopeWhere] } },
            ],
          },
          ...(filters?.category ? [{ category: filters.category }] : []),
          ...(filters?.projectId ? [{ projectId: filters.projectId }] : []),
          ...(filters?.tag ? [{ tags: { has: filters.tag } }] : []),
          ...(q
            ? [
                {
                  OR: [
                    { description: { contains: q, mode: 'insensitive' as const } },
                    {
                      recommendation: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                    { category: { contains: q, mode: 'insensitive' as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, departmentId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => this.toDto(row));
  }

  async getById(id: string, caslUser: CaslUserContext): Promise<LessonDto> {
    const row = await this.prisma.lessonsLearned.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, departmentId: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    if (row.projectId) {
      await this.assertProjectAccess(row.projectId, caslUser);
    }
    return this.toDto(row);
  }

  async create(
    dto: CreateLessonDto,
    authorId: string,
    caslUser: CaslUserContext,
  ): Promise<LessonDto> {
    if (dto.projectId) {
      await this.assertProjectAccess(dto.projectId, caslUser);
    }

    const created = await this.prisma.lessonsLearned.create({
      data: {
        projectId: dto.projectId ?? null,
        category: dto.category.trim(),
        description: dto.description.trim(),
        recommendation: dto.recommendation.trim(),
        tags: (dto.tags ?? []).map((t) => t.trim()).filter(Boolean),
        authorId,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, departmentId: true } },
      },
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    dto: UpdateLessonDto,
    caslUser: CaslUserContext,
  ): Promise<LessonDto> {
    const existing = await this.prisma.lessonsLearned.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Lesson not found');
    }
    if (existing.projectId) {
      await this.assertProjectAccess(existing.projectId, caslUser);
    }
    if (
      existing.authorId !== caslUser.id &&
      !['super_admin', 'pmo_lead', 'pm'].includes(caslUser.roleCode)
    ) {
      throw new ForbiddenException('You can only edit lessons you authored');
    }

    const updated = await this.prisma.lessonsLearned.update({
      where: { id },
      data: {
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.recommendation !== undefined
          ? { recommendation: dto.recommendation.trim() }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: dto.tags.map((t) => t.trim()).filter(Boolean) }
          : {}),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, departmentId: true } },
      },
    });
    return this.toDto(updated);
  }

  /**
   * Surface relevant lessons for project setup/closure (M4.6-03).
   */
  async surface(
    caslUser: CaslUserContext,
    opts: { projectId?: string; category?: string; departmentId?: string },
  ): Promise<LessonDto[]> {
    let departmentId = opts.departmentId;
    let category = opts.category;

    if (opts.projectId) {
      const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
      const project = await this.prisma.project.findFirst({
        where: { AND: [{ id: opts.projectId }, scopeWhere] },
        select: { id: true, departmentId: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found or not accessible');
      }
      departmentId = departmentId ?? project.departmentId ?? undefined;
    }

    const rows = await this.prisma.lessonsLearned.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(departmentId
          ? {
              OR: [
                { projectId: null },
                { project: { departmentId } },
              ],
            }
          : {}),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, departmentId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => this.toDto(row));
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

  private toDto(row: LessonRow): LessonDto {
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.project?.name,
      category: row.category,
      description: row.description,
      recommendation: row.recommendation,
      tags: row.tags,
      authorId: row.authorId,
      author: row.author
        ? {
            id: row.author.id,
            displayName: row.author.displayName,
            email: row.author.email,
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
