import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { ProjectStatus, TaskStatus, PhaseStatus, Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async getStats(caslUser: CaslUserContext) {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const taskScope = this.recordScopeWhere.taskWhere(caslUser, 'read');

    // 1. Projects aggregation
    const projects = await this.prisma.project.findMany({
      where: projectScope,
      select: {
        id: true,
        status: true,
        value: true,
      },
    });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === ProjectStatus.Active).length;
    const atRiskProjects = projects.filter((p) => p.status === ProjectStatus.Pending_Closure).length;
    const delayedProjects = projects.filter((p) => p.status === ProjectStatus.On_Hold).length;
    const completedProjects = projects.filter((p) => p.status === ProjectStatus.Closed).length;

    const totalValue = projects.reduce((sum, p) => sum + Number(p.value ?? 0), 0);

    // 2. Budget spent aggregation (from employee costs and budget line items)
    const projectIds = projects.map((p) => p.id);
    let totalSpent = 0;

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

    // 3. Tasks aggregation
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

    // 4. Resource count
    const totalResources = await this.prisma.employee.count({
      where: { isActive: true },
    });

    return {
      projects: {
        total: totalProjects,
        active: activeProjects,
        atRisk: atRiskProjects,
        delayed: delayedProjects,
        completed: completedProjects,
        totalValue,
        totalSpent,
        remainingBudget: Math.max(0, totalValue - totalSpent),
      },
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

    // Fetch budgets matching these projects to build a budgetId -> projectId mapping
    const budgets = projectIds.length
      ? await this.prisma.projectBudget.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true, projectId: true },
        })
      : [];

    const budgetIdToProjectId = new Map(budgets.map((b) => [b.id, b.projectId]));
    const budgetIds = budgets.map((b) => b.id);

    const [doneTasks, doneMilestones, employeeCosts, lineItems] = projectIds.length
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
          this.prisma.employeeCost.groupBy({
            by: ['projectId'],
            where: { projectId: { in: projectIds } },
            _sum: { totalCost: true },
          }),
          this.prisma.budgetLineItem.groupBy({
            by: ['budgetId'],
            where: { budgetId: { in: budgetIds } },
            _sum: { actual: true },
          }),
        ])
      : [[], [], [], []];

    const doneTasksMap = new Map(doneTasks.map((t) => [t.projectId, t._count._all]));
    const doneMilestonesMap = new Map(doneMilestones.map((m) => [m.projectId, m._count._all]));
    const employeeSpentMap = new Map(
      employeeCosts.map((c) => [c.projectId, Number(c._sum.totalCost ?? 0) / 1000]),
    );

    // Map nested budget actuals
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

      const totalVal = Number(p.value ?? 0);
      const spentVal = resolveBudgetSpent(p.id);
      const budgetAdherence = totalVal > 0 ? Math.round((spentVal / totalVal) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        pm: p.primaryPm ? p.primaryPm.displayName : 'Unassigned',
        status: this.mapStatus(p.status),
        progress,
        tasks: tasksTotal,
        risks: p._count.milestones - (doneMilestonesMap.get(p.id) ?? 0), // Pending milestones as simple risk proxy
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
      const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
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

    const [employees, departments, taskOwners] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        include: {
          department: { select: { name: true } },
          allocations: { where: { status: 'Active' } },
        },
      }),
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

    const activeTasksMap = new Map(
      taskOwners.map((o) => [o.ownerId, o._count._all]),
    );

    const team = employees.map((emp) => {
      // Utilization percent: sum of active allocations, fallback to 15% per active task if no allocations
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

      return {
        name: emp.name,
        role: emp.designation,
        dept: emp.department.name,
        util,
        billable: Math.round(util * 0.8), // Assume 80% of their utilization is billable
        projects: emp.allocations.length || (activeTasks > 0 ? 1 : 0),
        status,
      };
    });

    // Departments breakdown hours
    const deptBreakdown = departments.map((dept) => {
      const deptEmployees = employees.filter((e) => e.department.name === dept.name);
      
      let billable = 0;
      let nonBillable = 0;

      for (const emp of deptEmployees) {
        const activeTasks = emp.userId ? (activeTasksMap.get(emp.userId) ?? 0) : 0;
        const totalAllocatedHours = emp.allocations.reduce((sum, a) => sum + Number(a.hours ?? 0), 0);
        
        const hours = totalAllocatedHours > 0 ? totalAllocatedHours : (activeTasks * 24); // Est. 24h per task
        
        billable += Math.round(hours * 0.8);
        nonBillable += Math.round(hours * 0.2);
      }

      return {
        dept: dept.name,
        billable,
        nonBillable,
        total: billable + nonBillable,
      };
    }).filter((d) => d.total > 0);

    return {
      team: team.slice(0, 8), // Top 8 members
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const planned = new Array(12).fill(0);
    const actual = new Array(12).fill(0);

    // Populate planned curve
    for (const p of projects) {
      const val = Number(p.value ?? 0);
      if (val <= 0) continue;

      const start = new Date(p.startDate);
      const end = new Date(p.endDate);

      // Distribute value equally across project months in the current year
      const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      const monthlyVal = val / totalMonths;

      for (let m = 0; m < 12; m++) {
        const date = new Date(currentYear, m, 1);
        if (date >= new Date(start.getFullYear(), start.getMonth(), 1) && date <= new Date(end.getFullYear(), end.getMonth(), 28)) {
          planned[m] += Math.round(monthlyVal / 1000); // in $k
        }
      }
    }

    // Fetch actual spend per month in the current year
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
        const m = cost.periodMonth - 1; // 1-indexed to 0-indexed
        if (m >= 0 && m < 12) {
          actual[m] += Math.round(Number(cost._sum.totalCost ?? 0) / 1000);
        }
      }
    }

    // Cumulative sums
    let cumPlanned = 0;
    let cumActual = 0;
    const finalPlanned: number[] = [];
    const finalActual: (number | null)[] = [];
    const now = new Date();

    for (let m = 0; m < 12; m++) {
      cumPlanned += planned[m];
      finalPlanned.push(cumPlanned || 10); // avoid 0

      // Only show actual for past or current months
      if (currentYear < now.getFullYear() || (currentYear === now.getFullYear() && m <= now.getMonth())) {
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

  async getAuditFeed() {
    const logs = await this.prisma.auditLog.findMany({
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

      // Map action to locale keys
      if (log.action.toLowerCase().includes('create') && log.objectType === 'Project') {
        actionKey = 'createdProject';
        module = 'project';
      } else if (log.action.toLowerCase().includes('risk') || log.objectType === 'Risk') {
        actionKey = 'loggedRisk';
        module = 'risk';
      } else if (log.objectType === 'Timesheet') {
        actionKey = 'submittedTimesheet';
        module = 'time';
      } else if (log.action.toLowerCase().includes('user') || log.action.toLowerCase().includes('member')) {
        actionKey = 'addedTeamMember';
        module = 'people';
      } else if (log.objectType === 'TaskAttachment') {
        actionKey = 'uploadedDocument';
        module = 'doc';
      } else if (log.objectType === 'RolePermission' || log.objectType === 'Role') {
        actionKey = 'changedRBAC';
        module = 'settings';
      } else if (log.action.toLowerCase().includes('close') || log.action.toLowerCase().includes('resolve')) {
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

  private mapStatus(status: ProjectStatus): 'on-track' | 'at-risk' | 'delayed' {
    if (status === ProjectStatus.Active) return 'on-track';
    if (status === ProjectStatus.Pending_Closure) return 'at-risk';
    return 'delayed';
  }
}
