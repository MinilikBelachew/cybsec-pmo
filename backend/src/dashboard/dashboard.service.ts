import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { PermissionsCacheService } from '../casl/permissions-cache.service';
import { CaslUserContext } from '../casl/casl.types';
import { ProjectStatus, TaskStatus, Prisma } from '@prisma/client';
import {
  canViewDashboardAudit,
  canViewDashboardFinancials,
  canViewDashboardProjects,
} from './dashboard-permissions.util';
import { RECORD_SCOPE_ALL } from '../casl/record-scope.registry';
import { FxService } from '../fx/fx.service';
import { UtilisationService } from '../reports/utilisation.service';
import { roundHours } from '../reports/utils/utilisation-period.util';

export type DashboardFilters = {
  departmentId?: string;
  status?: string;
  primaryPmId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly fx: FxService,
    private readonly utilisationService: UtilisationService,
  ) {}

  private permissionsFor(user: CaslUserContext) {
    return this.permissionsCache.getByRoleId(user.roleId);
  }

  private filteredProjectWhere(
    caslUser: CaslUserContext,
    filters: DashboardFilters = {},
  ): Prisma.ProjectWhereInput {
    const conditions: Prisma.ProjectWhereInput[] = [
      this.recordScopeWhere.projectWhere(caslUser, 'read'),
    ];
    if (filters.departmentId) conditions.push({ departmentId: filters.departmentId });
    if (filters.primaryPmId) conditions.push({ primaryPmId: filters.primaryPmId });
    if (filters.status) conditions.push({ status: filters.status as ProjectStatus });
    if (filters.from) conditions.push({ endDate: { gte: new Date(filters.from) } });
    if (filters.to) conditions.push({ startDate: { lte: new Date(filters.to) } });
    return { AND: conditions };
  }

  private async scopedProjectIds(
    caslUser: CaslUserContext,
    filters: DashboardFilters = {},
  ): Promise<string[]> {
    const projects = await this.prisma.project.findMany({
      where: this.filteredProjectWhere(caslUser, filters),
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }

  async getStats(caslUser: CaslUserContext, filters: DashboardFilters = {}) {
    const permissions = this.permissionsFor(caslUser);
    const showFinancials = canViewDashboardFinancials(permissions);
    const showProjects = canViewDashboardProjects(permissions);
    const taskScope = this.recordScopeWhere.taskWhere(caslUser, 'read');

    let totalProjects = 0;
    let activeProjects = 0;
    let atRiskProjects = 0;
    let delayedProjects = 0;
    let completedProjects = 0;
    let totalValue = 0;
    let totalSpent = 0;
    let projectIds: string[] = [];

    if (showProjects) {
      if (showFinancials) {
        await this.fx.backfillMissingProjectValueUsd();
      }

      const projects = await this.prisma.project.findMany({
        where: this.filteredProjectWhere(caslUser, filters),
        select: {
          id: true,
          status: true,
          valueUsd: true,
        },
      });

      totalProjects = projects.length;
      activeProjects = projects.filter((p) => p.status === ProjectStatus.Active).length;
      atRiskProjects = projects.filter(
        (p) => p.status === ProjectStatus.At_Risk,
      ).length;
      delayedProjects = projects.filter((p) => p.status === ProjectStatus.On_Hold).length;
      completedProjects = projects.filter((p) => p.status === ProjectStatus.Closed).length;

      if (showFinancials) {
        totalValue = projects.reduce(
          (sum, p) => sum + Number(p.valueUsd ?? 0),
          0,
        );
        projectIds = projects.map((p) => p.id);

        if (projectIds.length > 0) {
          const [employeeCosts, lineItems] = await Promise.all([
            this.prisma.employeeCost.aggregate({
              where: { projectId: { in: projectIds } },
              _sum: { totalCost: true },
            }),
            this.prisma.budgetLineItem.aggregate({
              where: { budget: { projectId: { in: projectIds } } },
              _sum: { actual: true },
            }),
          ]);

          const empSum = Number(employeeCosts._sum.totalCost ?? 0) / 1000;
          const itemSum = Number(lineItems._sum.actual ?? 0) / 1000;
          totalSpent = empSum > 0 ? empSum : itemSum;
        }
      }
      if (!showFinancials) projectIds = projects.map((p) => p.id);
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          taskScope,
          ...(showProjects
            ? [{ projectId: { in: projectIds } } as Prisma.TaskWhereInput]
            : []),
        ],
      },
      select: {
        id: true,
        status: true,
        priority: true,
        endDate: true,
        progressApproved: true,
        parentTaskId: true,
      },
    });

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.Done).length;
    const openTasks = totalTasks - doneTasks;
    const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
    const completionRate =
      topLevelTasks.length > 0
        ? Math.round(
            topLevelTasks.reduce((sum, task) => sum + task.progressApproved, 0) /
              topLevelTasks.length,
          )
        : 0;

    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.status !== TaskStatus.Done && t.endDate && new Date(t.endDate) < now,
    ).length;

    const activeRisks = tasks.filter(
      (t) =>
        t.status !== TaskStatus.Done &&
        (t.priority === 'Critical' || t.priority === 'High'),
    ).length;

    const totalResources = showProjects
      ? await this.countScopedEmployees(caslUser, filters)
      : 0;

    const [pendingTimesheets, invoices] = projectIds.length
      ? await Promise.all([
          this.prisma.timesheet.count({
            where: { projectId: { in: projectIds }, status: 'Submitted' },
          }),
          this.prisma.invoice.findMany({
            where: { projectId: { in: projectIds } },
            select: { amount: true, status: true, collectionDate: true },
          }),
        ])
      : [0, []];
    const invoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const invoiceCollected = invoices
      .filter((invoice) =>
        invoice.collectionDate != null ||
        ['paid', 'collected'].includes(invoice.status.toLowerCase()),
      )
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const collectionPct =
      invoiceTotal > 0 ? Math.round((invoiceCollected / invoiceTotal) * 100) : 0;

    const projectsPayload: Record<string, number> = {
      total: totalProjects,
      active: activeProjects,
      atRisk: atRiskProjects,
      delayed: delayedProjects,
      completed: completedProjects,
    };

    if (showFinancials) {
      projectsPayload.totalValue = totalValue;
      projectsPayload.totalSpent = totalSpent;
      projectsPayload.remainingBudget = Math.max(0, totalValue - totalSpent);
    }

    return {
      projects: projectsPayload,
      tasks: {
        total: totalTasks,
        done: doneTasks,
        open: openTasks,
        overdue: overdueTasks,
        completionRate,
      },
      risks: {
        activeCount: activeRisks,
      },
      resources: {
        total: totalResources,
      },
      pendingTimesheets,
      collectionPct,
      dataFreshness: { source: 'live' as const, asOf: new Date().toISOString() },
    };
  }

  async getProjectHealth(caslUser: CaslUserContext, filters: DashboardFilters = {}) {
    const permissions = this.permissionsFor(caslUser);
    const showFinancials = canViewDashboardFinancials(permissions);
    const projects = await this.prisma.project.findMany({
      where: this.filteredProjectWhere(caslUser, filters),
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        value: true,
        primaryPm: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            tasks: { where: { parentTaskId: null } },
            milestones: true,
          },
        },
      },
    });

    const projectIds = projects.map((p) => p.id);

    const budgets = projectIds.length
      ? await this.prisma.projectBudget.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true, projectId: true },
        })
      : [];

    const budgetIdToProjectId = new Map(budgets.map((b) => [b.id, b.projectId]));
    const budgetIds = budgets.map((b) => b.id);

    const [taskProgress, doneMilestones] = projectIds.length
      ? await Promise.all([
          this.prisma.task.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              parentTaskId: null,
            },
            _avg: { progressApproved: true },
            _count: { _all: true },
          }),
          this.prisma.projectMilestone.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              status: 'Done',
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const employeeCosts =
      showFinancials && projectIds.length
        ? await this.prisma.employeeCost.groupBy({
            by: ['projectId'],
            where: { projectId: { in: projectIds } },
            _sum: { totalCost: true },
          })
        : [];

    const lineItems =
      showFinancials && budgetIds.length
        ? await this.prisma.budgetLineItem.groupBy({
            by: ['budgetId'],
            where: { budgetId: { in: budgetIds } },
            _sum: { actual: true },
          })
        : [];

    const taskProgressMap = new Map(
      taskProgress.map((row) => [
        row.projectId,
        {
          avg: Math.round(row._avg.progressApproved ?? 0),
          count: row._count._all,
        },
      ]),
    );
    const doneMilestonesMap = new Map(
      doneMilestones.map((m) => [m.projectId, m._count._all]),
    );
    const employeeSpentMap = new Map(
      employeeCosts.map((c) => [c.projectId, Number(c._sum.totalCost ?? 0) / 1000]),
    );

    const lineItemSpentMap = new Map<string, number>();
    for (const item of lineItems) {
      const projId = budgetIdToProjectId.get(item.budgetId);
      if (projId) {
        lineItemSpentMap.set(projId, Number(item._sum.actual ?? 0) / 1000);
      }
    }

    const resolveBudgetSpent = (projectId: string) => {
      const fromEmployee = employeeSpentMap.get(projectId) ?? 0;
      const fromLineItems = lineItemSpentMap.get(projectId) ?? 0;
      return fromEmployee > 0 ? fromEmployee : fromLineItems;
    };

    return projects.map((p) => {
      const tasksTotal = p._count.tasks;
      const approvedProgress = taskProgressMap.get(p.id);
      const progress =
        p.status === ProjectStatus.Closed
          ? 100
          : p.status === ProjectStatus.Draft
            ? 0
            : approvedProgress && approvedProgress.count > 0
              ? approvedProgress.avg
              : 0;

      const base = {
        id: p.id,
        name: p.name,
        pm: p.primaryPm ? p.primaryPm.displayName : 'Unassigned',
        status: this.mapStatus(p.status),
        progress,
        tasks: tasksTotal,
        risks: p._count.milestones - (doneMilestonesMap.get(p.id) ?? 0),
      };

      if (!showFinancials) {
        return base;
      }

      const totalVal = Number(p.value ?? 0);
      const spentVal = resolveBudgetSpent(p.id);
      const budgetAdherence = totalVal > 0 ? Math.round((spentVal / totalVal) * 100) : 0;

      return {
        ...base,
        budget: budgetAdherence,
      };
    });
  }

  async getMilestones(caslUser: CaslUserContext, filters: DashboardFilters = {}) {
    const milestones = await this.prisma.projectMilestone.findMany({
      where: {
        project: this.filteredProjectWhere(caslUser, filters),
      },
      orderBy: { targetDate: 'asc' },
      take: 10,
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    const now = new Date();

    return milestones.map((m) => {
      const target = new Date(m.targetDate);
      const daysLeft = Math.ceil(
        (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let status: 'completed' | 'on-track' | 'at-risk' | 'delayed' = 'on-track';
      if (m.status === 'Done' || m.status === 'Completed') {
        status = 'completed';
      } else if (daysLeft < 0) {
        status = 'delayed';
      } else if (daysLeft < 7) {
        status = 'at-risk';
      }

      return {
        id: m.id,
        projectId: m.project.id,
        project: m.project.name,
        label: m.title,
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status,
        daysLeft: status === 'completed' ? null : Math.max(0, daysLeft),
      };
    });
  }

  async getResources(caslUser: CaslUserContext, filters: DashboardFilters = {}) {
    const permissions = this.permissionsFor(caslUser);
    const hasReportsView = permissions.some(
      (permission) =>
        permission.module === 'reports' && permission.action === 'view',
    );
    const hasProjectFilter = Boolean(filters.status || filters.primaryPmId);
    const projectIds = hasProjectFilter
      ? await this.scopedProjectIds(caslUser, filters)
      : undefined;

    const snapshot = await this.utilisationService.getDashboardResourceSnapshot(
      caslUser,
      {
        departmentId: filters.departmentId,
        startDate: filters.from,
        endDate: filters.to,
        projectIds,
        useTeamDirectoryScope: !hasReportsView,
      },
    );

    const sortedRows = [...snapshot.rows].sort((left, right) => {
      if (right.billableUtilisationPercent !== left.billableUtilisationPercent) {
        return right.billableUtilisationPercent - left.billableUtilisationPercent;
      }
      if (right.approvedHours !== left.approvedHours) {
        return right.approvedHours - left.approvedHours;
      }
      return left.name.localeCompare(right.name);
    });

    const team = sortedRows.slice(0, 8).map((row) => ({
      name: row.name,
      role: row.designation,
      dept: row.departmentName,
      util: row.totalUtilisationPercent,
      billable: row.billableUtilisationPercent,
      projects: snapshot.projectCountByEmployeeId.get(row.employeeId) ?? 0,
      status: (row.status === 'optimal' ? 'ok' : row.status) as
        | 'over'
        | 'ok'
        | 'under',
    }));

    const departments = snapshot.departments
      .map((dept) => {
        const total = roundHours(dept.billableHours + dept.nonBillableHours);
        return {
          dept: dept.departmentName,
          billable: dept.billableHours,
          nonBillable: dept.nonBillableHours,
          total,
        };
      })
      .filter((dept) => dept.total > 0)
      .sort((a, b) => b.total - a.total);

    const optimalCount = Math.max(
      0,
      snapshot.summary.employeeCount -
        snapshot.summary.overCount -
        snapshot.summary.underCount,
    );

    return {
      team,
      departments,
      summary: {
        employeeCount: snapshot.summary.employeeCount,
        avgUtilization: snapshot.summary.avgBillableUtilisation,
        overallocatedCount: snapshot.summary.overCount,
        optimalCount,
        underutilizedCount: snapshot.summary.underCount,
        totalBillableHours: snapshot.summary.totalBillableHours,
        totalNonBillableHours: snapshot.summary.totalNonBillableHours,
      },
    };
  }

  async getBurnRate(caslUser: CaslUserContext, filters: DashboardFilters = {}) {
    await this.fx.backfillMissingProjectValueUsd();

    const projects = await this.prisma.project.findMany({
      where: this.filteredProjectWhere(caslUser, filters),
      select: {
        id: true,
        valueUsd: true,
        startDate: true,
        endDate: true,
      },
    });

    const projectIds = projects.map((p) => p.id);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const currentYear = new Date().getFullYear();

    const planned = new Array(12).fill(0);
    const actual = new Array(12).fill(0);

    for (const p of projects) {
      const val = Number(p.valueUsd ?? 0);
      if (val <= 0) continue;

      const start = new Date(p.startDate);
      const end = new Date(p.endDate);

      const totalMonths = Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()),
      );
      const monthlyVal = val / totalMonths;

      for (let m = 0; m < 12; m++) {
        const date = new Date(currentYear, m, 1);
        if (
          date >= new Date(start.getFullYear(), start.getMonth(), 1) &&
          date <= new Date(end.getFullYear(), end.getMonth(), 28)
        ) {
          planned[m] += Math.round(monthlyVal / 1000);
        }
      }
    }

    if (projectIds.length > 0) {
      const employeeCosts = await this.prisma.employeeCost.groupBy({
        by: ['periodYear', 'periodMonth'],
        where: {
          projectId: { in: projectIds },
          periodYear: currentYear,
        },
        _sum: { totalCost: true },
      });

      for (const cost of employeeCosts) {
        const m = cost.periodMonth - 1;
        if (m >= 0 && m < 12) {
          actual[m] += Math.round(Number(cost._sum.totalCost ?? 0) / 1000);
        }
      }
    }

    let cumPlanned = 0;
    let cumActual = 0;
    const finalPlanned: number[] = [];
    const finalActual: (number | null)[] = [];
    const now = new Date();

    for (let m = 0; m < 12; m++) {
      cumPlanned += planned[m];
      finalPlanned.push(cumPlanned || 10);

      if (
        currentYear < now.getFullYear() ||
        (currentYear === now.getFullYear() && m <= now.getMonth())
      ) {
        cumActual += actual[m];
        finalActual.push(cumActual);
      } else {
        finalActual.push(null);
      }
    }

    return {
      months,
      planned: finalPlanned,
      actual: finalActual,
      summary: {
        totalBudget: `$${(cumPlanned / 1000).toFixed(1)}M`,
        spentToDate: `$${(cumActual / 1000).toFixed(1)}M`,
        remaining: `$${Math.max(0, (cumPlanned - cumActual) / 1000).toFixed(1)}M`,
        forecastEoy: `$${((cumActual > 0 ? (cumActual / (now.getMonth() + 1)) * 12 : cumPlanned) / 1000).toFixed(1)}M`,
      },
    };
  }

  async getAuditFeed(caslUser: CaslUserContext) {
    const permissions = this.permissionsFor(caslUser);
    if (!canViewDashboardAudit(permissions)) {
      return [];
    }

    const auditScope = permissions.find(
      (permission) => permission.module === 'audit' && permission.action === 'view',
    )?.recordScope;

    const where: Prisma.AuditLogWhereInput =
      auditScope && auditScope !== RECORD_SCOPE_ALL
        ? { actorId: caslUser.id }
        : {};

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: { select: { displayName: true } },
      },
    });

    const now = new Date();

    return logs.map((log) => {
      const actor = log.user?.displayName || 'System';
      let actionKey = 'updatedTaskStatus';
      let module = 'task';

      if (log.action.toLowerCase().includes('create') && log.objectType === 'Project') {
        actionKey = 'createdProject';
        module = 'project';
      } else if (log.action.toLowerCase().includes('risk') || log.objectType === 'Risk') {
        actionKey = 'loggedRisk';
        module = 'risk';
      } else if (log.objectType === 'Timesheet') {
        actionKey = 'submittedTimesheet';
        module = 'time';
      } else if (
        log.action.toLowerCase().includes('user') ||
        log.action.toLowerCase().includes('member')
      ) {
        actionKey = 'addedTeamMember';
        module = 'people';
      } else if (
        log.objectType === 'TaskAttachment' ||
        log.objectType === 'WorkspaceDocument'
      ) {
        actionKey = 'uploadedDocument';
        module = 'doc';
      } else if (log.objectType === 'RolePermission' || log.objectType === 'Role') {
        actionKey = 'changedRBAC';
        module = 'settings';
      } else if (
        log.action.toLowerCase().includes('close') ||
        log.action.toLowerCase().includes('resolve')
      ) {
        actionKey = 'closedIssue';
        module = 'risk';
      }

      const diff = Math.abs(now.getTime() - new Date(log.createdAt).getTime());
      const mins = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);

      let time = `${mins}m`;
      if (days > 0) {
        time = `${days}d`;
      } else if (hours > 0) {
        time = `${hours}h`;
      }

      return {
        actor,
        actionKey,
        target: `${log.objectType} ${log.objectId ? log.objectId.substring(0, 5) : ''}`,
        module,
        time,
        createdAt: log.createdAt,
      };
    });
  }

  private async countScopedEmployees(
    caslUser: CaslUserContext,
    filters: DashboardFilters = {},
  ): Promise<number> {
    const projectIds = await this.scopedProjectIds(caslUser, filters);
    if (!projectIds.length) {
      return 0;
    }

    const allocations = await this.prisma.allocation.findMany({
      where: { projectId: { in: projectIds }, status: 'Active' },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });

    return allocations.length;
  }

  private mapStatus(status: ProjectStatus): 'on-track' | 'at-risk' | 'delayed' {
    if (status === ProjectStatus.Active) return 'on-track';
    if (
      status === ProjectStatus.At_Risk ||
      status === ProjectStatus.Pending_Closure
    ) {
      return 'at-risk';
    }
    if (
      status === ProjectStatus.On_Hold ||
      status === ProjectStatus.Cancelled
    ) {
      return 'delayed';
    }
    return 'on-track';
  }
}
