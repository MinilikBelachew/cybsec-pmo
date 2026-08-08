import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { RoleEnum } from '../roles/roles.enum';
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

const LESSON_MANAGER_ROLES = new Set(['super_admin', 'pmo_lead', 'pm']);
const LESSON_DENIED_ROLES = new Set<string>([RoleEnum.engineer]);

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  private assertCanAccessLessons(caslUser: CaslUserContext): void {
    if (caslUser.roleCode && LESSON_DENIED_ROLES.has(caslUser.roleCode)) {
      throw new ForbiddenException(
        'You do not have permission to access lessons learned',
      );
    }
  }

  async list(
    caslUser: CaslUserContext,
    filters?: {
      category?: string;
      projectId?: string;
      q?: string;
      tag?: string;
    },
  ): Promise<LessonDto[]> {
    this.assertCanAccessLessons(caslUser);
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const q = filters?.q?.trim();

    const rows = await this.prisma.lessonsLearned.findMany({
      where: {
        AND: [
          {
            OR: [{ projectId: null }, { project: { AND: [scopeWhere] } }],
          },
          ...(filters?.category ? [{ category: filters.category }] : []),
          ...(filters?.projectId ? [{ projectId: filters.projectId }] : []),
          ...(filters?.tag ? [{ tags: { has: filters.tag } }] : []),
          ...(q
            ? [
                {
                  OR: [
                    {
                      description: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      recommendation: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      category: {
                        contains: q,
                        mode: 'insensitive' as const,
                      },
                    },
                    { tags: { has: q } },
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
    this.assertCanAccessLessons(caslUser);
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
    this.assertCanAccessLessons(caslUser);
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
    this.assertCanAccessLessons(caslUser);
    const existing = await this.prisma.lessonsLearned.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Lesson not found');
    }
    if (existing.projectId) {
      await this.assertProjectAccess(existing.projectId, caslUser);
    }
    this.assertCanMutate(existing.authorId, caslUser);

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

  async delete(id: string, caslUser: CaslUserContext): Promise<void> {
    this.assertCanAccessLessons(caslUser);
    const existing = await this.prisma.lessonsLearned.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Lesson not found');
    }
    if (existing.projectId) {
      await this.assertProjectAccess(existing.projectId, caslUser);
    }
    this.assertCanMutate(existing.authorId, caslUser);
    await this.prisma.lessonsLearned.delete({ where: { id } });
  }

  /**
   * Surface relevant lessons for project setup/closure (M4.6-03).
   * Always scoped like list(); optional department narrows further.
   */
  async surface(
    caslUser: CaslUserContext,
    opts: { projectId?: string; category?: string; departmentId?: string },
  ): Promise<LessonDto[]> {
    this.assertCanAccessLessons(caslUser);
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    let departmentId = opts.departmentId;
    const category = opts.category;

    if (opts.projectId) {
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
        AND: [
          {
            OR: [{ projectId: null }, { project: { AND: [scopeWhere] } }],
          },
          ...(category ? [{ category }] : []),
          ...(departmentId
            ? [
                {
                  OR: [
                    { projectId: null },
                    { project: { departmentId } },
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
      take: 20,
    });
    return rows.map((row) => this.toDto(row));
  }

  private assertCanMutate(authorId: string, caslUser: CaslUserContext): void {
    if (
      authorId !== caslUser.id &&
      !LESSON_MANAGER_ROLES.has(caslUser.roleCode)
    ) {
      throw new ForbiddenException('You can only edit lessons you authored');
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
