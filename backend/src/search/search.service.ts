import { Injectable } from '@nestjs/common';
import { subject } from '@casl/ability';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { AppAbility, CaslUserContext } from '../casl/casl.types';
import {
  GlobalSearchItemDto,
  GlobalSearchResponseDto,
} from './dto/global-search-response.dto';
import {
  QueryGlobalSearchDto,
  SearchCategory,
} from './dto/query-global-search.dto';
import { SEARCH_NAV_ITEMS } from './search-nav.constants';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async search(
    query: QueryGlobalSearchDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ): Promise<GlobalSearchResponseDto> {
    const q = query.q?.trim() ?? '';
    const limit = Math.min(query.limit ?? 10, 20);
    const category = query.category ?? 'all';
    const perCategoryLimit = category === 'all' ? Math.min(limit, 5) : limit;

    const availableCategories = this.resolveAvailableCategories(ability);
    const items: GlobalSearchItemDto[] = [];
    const facets: GlobalSearchResponseDto['facets'] = {};

    const includeCategory = (cat: Exclude<SearchCategory, 'all'>) =>
      category === 'all' || category === cat;

    if (
      includeCategory('projects') &&
      availableCategories.includes('projects')
    ) {
      const projectItems = await this.searchProjects(
        caslUser,
        q,
        perCategoryLimit,
      );
      items.push(...projectItems);
      facets.projects = projectItems.length;
    }

    if (includeCategory('tasks') && availableCategories.includes('tasks')) {
      const taskItems = await this.searchTasks(caslUser, q, perCategoryLimit);
      items.push(...taskItems);
      facets.tasks = taskItems.length;
    }

    if (includeCategory('people') && availableCategories.includes('people')) {
      const userItems = await this.searchUsers(q, perCategoryLimit);
      items.push(...userItems);
      facets.people = userItems.length;
    }

    if (includeCategory('audit') && availableCategories.includes('audit')) {
      const auditItems = await this.searchAuditLogs(q, perCategoryLimit);
      items.push(...auditItems);
      facets.audit = auditItems.length;
    }

    if (includeCategory('apps') && availableCategories.includes('apps')) {
      const appItems = this.searchNavApps(ability, q, perCategoryLimit);
      items.push(...appItems);
      facets.apps = appItems.length;
    }

    return {
      items,
      availableCategories: ['all', ...availableCategories],
      facets,
    };
  }

  private resolveAvailableCategories(
    ability: AppAbility,
  ): Exclude<SearchCategory, 'all'>[] {
    const categories: Exclude<SearchCategory, 'all'>[] = [];

    if (this.canRead(ability, 'Project')) {
      categories.push('projects');
    }
    if (this.canRead(ability, 'Task')) {
      categories.push('tasks');
    }
    if (this.canRead(ability, 'User')) {
      categories.push('people');
    }
    if (this.canRead(ability, 'AuditLog')) {
      categories.push('audit');
    }

    const hasNav = SEARCH_NAV_ITEMS.some((item) =>
      this.canAccessNavItem(ability, item.permission),
    );
    if (hasNav) {
      categories.push('apps');
    }

    return categories;
  }

  private canRead(ability: AppAbility, subjectName: string): boolean {
    return ability.can(
      'read',
      subject(subjectName, { __caslSubjectType__: subjectName }),
    );
  }

  private canAccessNavItem(
    ability: AppAbility,
    permission?: { action: string; subject: string } | null,
  ): boolean {
    if (!permission) return true;
    return ability.can(
      permission.action,
      subject(permission.subject, {
        __caslSubjectType__: permission.subject,
      }),
    );
  }

  private async searchProjects(
    caslUser: CaslUserContext,
    q: string,
    limit: number,
  ): Promise<GlobalSearchItemDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const filters: Prisma.ProjectWhereInput[] = [scopeWhere];

    if (q) {
      filters.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { objective: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const projects = await this.prisma.project.findMany({
      where: { AND: filters },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        department: { select: { name: true } },
      },
    });

    return projects.map((project) => ({
      id: project.id,
      type: 'project',
      title: project.name,
      subtitle: project.department?.name
        ? `in ${project.department.name}`
        : 'Project',
      href: `/dashboard/projects/${project.id}`,
      updatedAt: project.updatedAt.toISOString(),
      category: 'Projects',
    }));
  }

  private async searchTasks(
    caslUser: CaslUserContext,
    q: string,
    limit: number,
  ): Promise<GlobalSearchItemDto[]> {
    const scopeWhere = this.recordScopeWhere.taskWhere(caslUser, 'read');
    const filters: Prisma.TaskWhereInput[] = [scopeWhere];

    if (q) {
      filters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const tasks = await this.prisma.task.findMany({
      where: { AND: filters },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        projectId: true,
        project: { select: { name: true } },
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: task.project?.name
        ? `in ${task.project.name}`
        : 'Task',
      href: `/dashboard/projects/${task.projectId}?taskId=${task.id}`,
      updatedAt: task.updatedAt.toISOString(),
      category: 'Tasks',
    }));
  }

  private async searchUsers(
    q: string,
    limit: number,
  ): Promise<GlobalSearchItemDto[]> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        updatedAt: true,
        role: { select: { label: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      type: 'user',
      title: user.displayName,
      subtitle: user.role?.label ?? user.email,
      href: '/dashboard/settings',
      updatedAt: user.updatedAt.toISOString(),
      category: 'People',
    }));
  }

  private async searchAuditLogs(
    q: string,
    limit: number,
  ): Promise<GlobalSearchItemDto[]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (q) {
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { objectType: { contains: q, mode: 'insensitive' } },
        { source: { contains: q, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        objectType: true,
        createdAt: true,
        user: { select: { displayName: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      type: 'audit',
      title: log.action,
      subtitle: [log.objectType, log.user?.displayName]
        .filter(Boolean)
        .join(' · '),
      href: '/dashboard/audit',
      updatedAt: log.createdAt.toISOString(),
      category: 'Audit',
    }));
  }

  private searchNavApps(
    ability: AppAbility,
    q: string,
    limit: number,
  ): GlobalSearchItemDto[] {
    const normalized = q.toLowerCase();

    return SEARCH_NAV_ITEMS.filter((item) => {
      if (!this.canAccessNavItem(ability, item.permission)) {
        return false;
      }
      if (!normalized) return true;
      return (
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle.toLowerCase().includes(normalized)
      );
    })
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        type: 'app' as const,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        category: 'Apps',
      }));
  }
}
