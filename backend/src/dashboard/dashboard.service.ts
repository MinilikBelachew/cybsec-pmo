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

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly permissionsCache: PermissionsCacheService,
  ) {}

  private permissionsFor(user: CaslUserContext) {
    return this.permissionsCache.getByRoleId(user.roleId);
  }

  private async scopedProjectIds(caslUser: CaslUserContext): Promise<string[]> {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const projects = await this.prisma.project.findMany({
      where: projectScope,
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }

  async getStats(caslUser: CaslUserContext) {
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

    if (showProjects) {
      const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');
      const projects = await this.prisma.project.findMany({
        where: projectScope,
        select: {
          id: true,
          status: true,
          value: true,
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
        totalValue = projects.reduce((sum, p) => sum + Number(p.value ?? 0), 0);
        const projectIds = projects.map((p) => p.id);

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
    }

    const tasks = await this.prisma.task.findMany({
      where: taskScope,
      select: {
        id: true,
        status: true,
        priority: true,
        endDate: true,
      },
    });

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.Done).length;
    const openTasks = totalTasks - doneTasks;

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
      ? await this.countScopedEmployees(caslUser)
      : 0;

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
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      risks: {
        activeCount: activeRisks,
      },
      resources: {
        total: totalResources,
      },
    };
  }

  async getProjectHealth(caslUser: CaslUserContext) {
    const permissions = this.permissionsFor(caslUser);
    const showFinancials = canViewDashboardFinancials(permissions);
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');

    const projects = await this.prisma.project.findMany({
      where: projectScope,
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

    const [doneTasks, doneMilestones] = projectIds.length
      ? await Promise.all([
          this.prisma.task.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              parentTaskId: null,
              status: TaskStatus.Done,
            },
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

    const doneTasksMap = new Map(doneTasks.map((t) => [t.projectId, t._count._all]));
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
      const tasksDone = doneTasksMap.get(p.id) ?? 0;
      const progress =
        p.status === ProjectStatus.Closed
          ? 100
          : p.status === ProjectStatus.Draft
            ? 0
            : tasksTotal > 0
              ? Math.round((tasksDone / tasksTotal) * 100)
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

  async getMilestones(caslUser: CaslUserContext) {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');

    const milestones = await this.prisma.projectMilestone.findMany({
      where: {
        project: projectScope,
      },
      orderBy: { targetDate: 'asc' },
      take: 10,
      include: {
        project: { select: { name: true } },
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
        project: m.project.name,
        label: m.title,
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status,
        daysLeft: status === 'completed' ? null : Math.max(0, daysLeft),
      };
    });
  }

  async getResources(caslUser: CaslUserContext) {
    const taskScope = this.recordScopeWhere.taskWhere(caslUser, 'read');
    const projectIds = await this.scopedProjectIds(caslUser);

    const allocationWhere: Prisma.AllocationWhereInput = projectIds.length
      ? { projectId: { in: projectIds }, status: 'Active' }
      : { id: '__scoped_none__' };

    const allocations = await this.prisma.allocation.findMany({
      where: allocationWhere,
      select: { employeeId: true, projectId: true, percent: true, hours: true },
    });

    const scopedEmployeeIds = [
      ...new Set(allocations.map((row) => row.employeeId)),
    ] as string[];

    const [departments, taskOwners] = await Promise.all([
      this.prisma.department.findMany({
        where: { isActive: true },
        select: { name: true },
      }),
      this.prisma.task.groupBy({
        by: ['ownerId'],
        where: {
          AND: [taskScope, { status: { not: TaskStatus.Done } }],
        },
        _count: { _all: true },
      }),
    ]);

    const employees = scopedEmployeeIds.length
      ? await this.prisma.employee.findMany({
          where: { isActive: true, id: { in: scopedEmployeeIds } },
          include: {
            department: { select: { name: true } },
            allocations: {
              where: {
                status: 'Active',
                ...(projectIds.length ? { projectId: { in: projectIds } } : {}),
              },
            },
          },
        })
      : [];

    const activeTasksMap = new Map(
      taskOwners.map((o) => [o.ownerId, o._count._all]),
    );

    const team = employees.map((emp) => {
      let util = emp.allocations.reduce((sum, a) => sum + Number(a.percent ?? 0), 0);
      const activeTasks = emp.userId ? (activeTasksMap.get(emp.userId) ?? 0) : 0;

      if (util === 0) {
        util = Math.min(100, activeTasks * 15);
      }

      let status: 'over' | 'ok' | 'under' = 'ok';
      if (util > 90) {
        status = 'over';
      } else if (util < 50) {
        status = 'under';
      }

      const projectCount = new Set(emp.allocations.map((a) => a.projectId)).size;

      return {
        name: emp.name,
        role: emp.designation,
        dept: emp.department.name,
        util,
        billable: Math.round(util * 0.8),
        projects: projectCount || (activeTasks > 0 ? 1 : 0),
        status,
      };
    });

    const scopedDeptNames = new Set(employees.map((emp) => emp.department.name));

    const deptBreakdown = departments
      .filter((dept) => scopedDeptNames.has(dept.name))
      .map((dept) => {
        const deptEmployees = employees.filter((e) => e.department.name === dept.name);

        let billable = 0;
        let nonBillable = 0;

        for (const emp of deptEmployees) {
          const activeTasks = emp.userId ? (activeTasksMap.get(emp.userId) ?? 0) : 0;
          const totalAllocatedHours = emp.allocations.reduce(
            (sum, a) => sum + Number(a.hours ?? 0),
            0,
          );

          const hours = totalAllocatedHours > 0 ? totalAllocatedHours : activeTasks * 24;

          billable += Math.round(hours * 0.8);
          nonBillable += Math.round(hours * 0.2);
        }

        return {
          dept: dept.name,
          billable,
          nonBillable,
          total: billable + nonBillable,
        };
      })
      .filter((d) => d.total > 0);

    return {
      team: team.slice(0, 8),
      departments: deptBreakdown,
    };
  }

  async getBurnRate(caslUser: CaslUserContext) {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');

    const projects = await this.prisma.project.findMany({
      where: projectScope,
      select: {
        id: true,
        value: true,
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
      const val = Number(p.value ?? 0);
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
      } else if (log.objectType === 'TaskAttachment') {
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

  private async countScopedEmployees(caslUser: CaslUserContext): Promise<number> {
    const projectIds = await this.scopedProjectIds(caslUser);
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
