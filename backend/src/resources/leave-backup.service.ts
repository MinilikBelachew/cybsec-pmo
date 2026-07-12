import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PriorityLevel, Prisma, TaskStatus } from '@prisma/client';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { PrismaService } from '../database/prisma.service';
import {
  LeaveImpactListResponseDto,
  LeaveImpactRowDto,
  QueryLeaveImpactsDto,
  TaskScheduleImpactDto,
} from './dto/leave-impact.dto';
import {
  notifyLeaveCriticalConflict,
  resolveProjectPmUserIds,
} from './leave-backup-notifications.util';
import {
  countOverlapDays,
  findOverlappingApprovedLeave,
  isTaskCritical,
  leaveImpactSourceObjectId,
  resolveTaskScheduleWindow,
  rangesOverlap,
  toDateKey,
  addDaysToKey,
} from './utils/leave-impact.util';
import {
  groupLeaveRecords,
  LeaveRangeSummary,
} from '../projects/utils/leave-summary.util';
import { TaskDependenciesService } from '../tasks/task-dependencies.service';

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.To_Do,
  TaskStatus.In_Progress,
  TaskStatus.Submitted_for_Review,
  TaskStatus.Rework,
];

/** Projects in these statuses can trigger leave-critical PM alerts. */
const LEAVE_ALERT_PROJECT_STATUSES = [
  'Draft',
  'Active',
  'On_Hold',
  'At_Risk',
  'Pending_Closure',
] as const;

type ImpactCandidate = {
  task: {
    id: string;
    projectId: string;
    title: string;
    priority: PriorityLevel;
    isOnCriticalPath: boolean;
    startDate: Date | null;
    endDate: Date | null;
    ownerId: string | null;
    backupOwnerId: string | null;
    backupOwner: { id: string; displayName: string } | null;
    project: { name: string };
    owner: {
      id: string;
      displayName: string;
      employees: { id: string } | null;
    } | null;
  };
  employee: {
    id: string;
    name: string;
    userId: string | null;
    leaveRecords: Array<{
      id: string;
      leaveDate: Date;
      leaveType: string;
      isApproved: boolean;
      kekaStatus: number | null;
    }>;
  };
  allocationBackup: {
    id?: string;
    backupEmployeeId: string | null;
    backupEmployee: { id: string; name: string; userId?: string | null } | null;
  } | null;
  leave: LeaveRangeSummary;
  overlapDays: number;
  estimatedDelayDays: number;
  projectedTaskEnd: string | null;
  downstreamTaskCount: number;
  isCriticalAllocation: boolean;
  allocationId: string | null;
};

@Injectable()
export class LeaveBackupService {
  private readonly logger = new Logger(LeaveBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => TaskDependenciesService))
    private readonly taskDependenciesService: TaskDependenciesService,
  ) {}

  async listImpacts(
    query: QueryLeaveImpactsDto,
    caslUser: CaslUserContext,
  ): Promise<LeaveImpactListResponseDto> {
    const projectWhere = query.projectId
      ? { id: query.projectId }
      : this.recordScopeWhere.projectWhere(caslUser, 'read');

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true },
    });

    const rows: LeaveImpactRowDto[] = [];

    for (const project of projects) {
      const impacts = await this.collectProjectImpacts(project.id);
      rows.push(
        ...impacts.map((impact) => this.mapImpactRow(impact, project.name)),
      );
    }

    rows.sort((a, b) => b.task.overlapDays - a.task.overlapDays);

    return {
      rows,
      criticalCount: rows.filter((row) => row.isCritical).length,
      withoutBackupCount: rows.filter((row) => !row.hasBackup).length,
    };
  }

  async evaluateConflictsAndNotify(
    actorId?: string,
    employeeIds?: string[],
  ): Promise<number> {
    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: [...LEAVE_ALERT_PROJECT_STATUSES] },
      },
      select: { id: true, name: true },
    });

    let notified = 0;
    const dedupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const employeeFilter = employeeIds?.length
      ? new Set(employeeIds)
      : null;

    for (const project of projects) {
      const impacts = await this.collectProjectImpacts(project.id);

      for (const impact of impacts) {
        if (employeeFilter && !employeeFilter.has(impact.employee.id)) {
          continue;
        }

        const shouldAlert =
          isTaskCritical(impact.task.priority, impact.task.isOnCriticalPath) ||
          impact.isCriticalAllocation;

        if (!shouldAlert) {
          continue;
        }

        const sourceObjectId = leaveImpactSourceObjectId(
          impact.task.id,
          impact.leave.from,
          impact.leave.to,
        );
        const alreadySent = await this.prisma.notification.findFirst({
          where: {
            eventType: NOTIFICATION_EVENT_TYPE.LEAVE_CRITICAL_CONFLICT,
            sourceObjectId,
            createdAt: { gte: dedupeSince },
          },
        });

        if (alreadySent) {
          continue;
        }

        const pmIds = await resolveProjectPmUserIds(
          this.notificationsService,
          project.id,
        );

        if (pmIds.length === 0) {
          continue;
        }

        const backup = await this.resolveBackupForImpact(impact);

        await notifyLeaveCriticalConflict(this.notificationsService, {
          recipientUserIds: pmIds,
          employeeName: impact.employee.name,
          projectId: project.id,
          projectName: project.name,
          taskId: impact.task.id,
          taskTitle: impact.task.title,
          leaveFrom: impact.leave.from,
          leaveTo: impact.leave.to,
          overlapDays: impact.overlapDays,
          estimatedDelayDays: impact.estimatedDelayDays,
          projectedTaskEnd: impact.projectedTaskEnd,
          hasBackup: backup.hasBackup,
          canApplyBackup: backup.canApplyBackup,
          backupUserId: backup.backupUserId,
          backupName: backup.backupName,
          allocationId: impact.allocationId,
          isCriticalAllocation: impact.isCriticalAllocation,
          actorId,
        });

        notified += 1;
      }
    }

    if (notified > 0) {
      this.logger.log(`Sent ${notified} leave-critical conflict notification(s)`);
    }

    return notified;
  }

  async applyTaskBackup(
    projectId: string,
    taskId: string,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            employees: { select: { id: true } },
          },
        },
        backupOwner: { select: { id: true, displayName: true } },
      },
    });

    if (!task) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'notFound' },
      });
    }

    const backup = await this.resolveBackupUserForTask(task);
    if (!backup.userId) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { backup: 'noBackupConfigured' },
      });
    }

    if (backup.userId === task.ownerId) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { backup: 'alreadyAssigned' },
      });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { ownerId: backup.userId },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
    });

    return {
      taskId: updated.id,
      ownerId: updated.ownerId,
      ownerName: updated.owner?.displayName ?? null,
      backupSource: backup.source,
    };
  }

  async setAllocationBackup(
    projectId: string,
    allocationId: string,
    backupEmployeeId: string | null,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser);

    const allocation = await this.prisma.allocation.findFirst({
      where: { id: allocationId, projectId },
    });

    if (!allocation) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { allocation: 'notFound' },
      });
    }

    if (backupEmployeeId && backupEmployeeId === allocation.employeeId) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { backupEmployeeId: 'cannotMatchPrimaryEmployee' },
      });
    }

    if (backupEmployeeId) {
      const backup = await this.prisma.employee.findFirst({
        where: { id: backupEmployeeId, isActive: true },
      });

      if (!backup) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { backupEmployeeId: 'notFound' },
        });
      }
    }

    return this.prisma.allocation.update({
      where: { id: allocationId },
      data: { backupEmployeeId },
      select: { id: true, backupEmployeeId: true },
    });
  }

  async resolveTaskScheduleImpact(task: {
    id: string;
    projectId: string;
    priority: PriorityLevel;
    isOnCriticalPath: boolean;
    startDate: Date | null;
    endDate: Date | null;
    ownerId: string | null;
    backupOwnerId: string | null;
    owner?: {
      employees?: { id: string } | null;
    } | null;
  }): Promise<TaskScheduleImpactDto | null> {
    if (!task.ownerId) {
      return null;
    }

    const employeeId = task.owner?.employees?.id;
    if (!employeeId) {
      return null;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        leaveRecords: { orderBy: { leaveDate: 'asc' } },
        allocations: {
          where: {
            projectId: task.projectId,
            status: 'Active',
          },
          select: {
            backupEmployeeId: true,
          },
          take: 1,
        },
      },
    });

    if (!employee) {
      return null;
    }

    const leaveRanges = groupLeaveRecords(employee.leaveRecords);
    const taskWindow = resolveTaskScheduleWindow(task.startDate, task.endDate);
    const overlapping = findOverlappingApprovedLeave(leaveRanges, taskWindow);

    if (overlapping.length === 0) {
      return {
        hasLeaveConflict: false,
        overlapDays: 0,
        estimatedDelayDays: 0,
        projectedTaskEnd: null,
        downstreamTaskCount: 0,
        leaveFrom: null,
        leaveTo: null,
        leaveType: null,
        isCritical: isTaskCritical(task.priority, task.isOnCriticalPath),
        hasBackup: Boolean(task.backupOwnerId || employee.allocations[0]?.backupEmployeeId),
      };
    }

    const primaryLeave = overlapping[0];
    const overlapDays = countOverlapDays(primaryLeave, taskWindow);
    const slip = await this.taskDependenciesService.previewLeaveScheduleSlip(
      task.projectId,
      task.id,
      overlapDays,
    );

    return {
      hasLeaveConflict: true,
      overlapDays,
      estimatedDelayDays: slip.estimatedDelayDays,
      projectedTaskEnd: slip.projectedTaskEnd,
      downstreamTaskCount: slip.downstreamTaskCount,
      leaveFrom: primaryLeave.from,
      leaveTo: primaryLeave.to,
      leaveType: primaryLeave.type,
      isCritical: isTaskCritical(task.priority, task.isOnCriticalPath),
      hasBackup: Boolean(task.backupOwnerId || employee.allocations[0]?.backupEmployeeId),
    };
  }

  async enrichTasksWithScheduleImpact<T extends { id: string }>(
    tasks: T[],
    loader: (taskId: string) => Promise<TaskScheduleImpactDto | null>,
  ): Promise<Array<T & { scheduleImpact: TaskScheduleImpactDto | null }>> {
    const enriched: Array<T & { scheduleImpact: TaskScheduleImpactDto | null }> = [];

    for (const task of tasks) {
      enriched.push({
        ...task,
        scheduleImpact: await loader(task.id),
      });
    }

    return enriched;
  }

  private async collectProjectImpacts(projectId: string): Promise<ImpactCandidate[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        ownerId: { not: null },
        status: { in: ACTIVE_TASK_STATUSES },
      },
      include: {
        project: { select: { name: true } },
        owner: {
          select: {
            id: true,
            displayName: true,
            employees: { select: { id: true } },
          },
        },
        backupOwner: { select: { id: true, displayName: true } },
      },
    });

    const impacts: ImpactCandidate[] = [];
    const seen = new Set<string>();

    const pushImpact = async (candidate: Omit<ImpactCandidate, 'estimatedDelayDays' | 'projectedTaskEnd' | 'downstreamTaskCount'> & { overlapDays: number }) => {
      const key = `${candidate.task.id}:${candidate.leave.from}:${candidate.leave.to}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      const slip = await this.taskDependenciesService.previewLeaveScheduleSlip(
        projectId,
        candidate.task.id,
        candidate.overlapDays,
      );

      impacts.push({
        ...candidate,
        estimatedDelayDays: slip.estimatedDelayDays,
        projectedTaskEnd: slip.projectedTaskEnd,
        downstreamTaskCount: slip.downstreamTaskCount,
      });
    };

    for (const task of tasks) {
      const employeeId = task.owner?.employees?.id;

      if (!employeeId || !task.owner) {
        continue;
      }

      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          leaveRecords: { orderBy: { leaveDate: 'asc' } },
          allocations: {
            where: {
              projectId,
              status: 'Active',
            },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              backupEmployeeId: true,
              backupEmployee: { select: { id: true, name: true, userId: true } },
            },
          },
        },
      });

      if (!employee) {
        continue;
      }

      const leaveRanges = groupLeaveRecords(employee.leaveRecords);
      const taskWindow = resolveTaskScheduleWindow(task.startDate, task.endDate);
      const overlapping = findOverlappingApprovedLeave(leaveRanges, taskWindow);
      const allocation = employee.allocations[0] ?? null;
      const taskIsCritical = isTaskCritical(task.priority, task.isOnCriticalPath);

      for (const leave of overlapping) {
        const overlapDays = countOverlapDays(leave, taskWindow);
        if (overlapDays <= 0) {
          continue;
        }

        const allocationOverlapsLeave = allocation
          ? this.allocationOverlapsLeave(allocation, leave)
          : false;

        await pushImpact({
          task,
          employee: {
            id: employee.id,
            name: employee.name,
            userId: employee.userId,
            leaveRecords: employee.leaveRecords,
          },
          allocationBackup: allocation,
          leave,
          overlapDays,
          isCriticalAllocation: allocationOverlapsLeave && taskIsCritical,
          allocationId: allocation?.id ?? null,
        });
      }

      for (const leave of leaveRanges) {
        if (leave.status !== 'approved' || !allocation) {
          continue;
        }
        if (!this.allocationOverlapsLeave(allocation, leave)) {
          continue;
        }
        if (!taskIsCritical) {
          continue;
        }
        if (countOverlapDays(leave, taskWindow) > 0) {
          continue;
        }

        const taskEndKey = task.endDate ? toDateKey(task.endDate) : null;
        if (taskEndKey && taskEndKey < leave.from) {
          continue;
        }

        const allocFrom = toDateKey(allocation.startDate);
        const allocTo = allocation.endDate
          ? toDateKey(allocation.endDate)
          : addDaysToKey(allocFrom, 365);
        const allocationLeaveOverlap = countOverlapDays(leave, {
          from: allocFrom,
          to: allocTo,
        });
        if (allocationLeaveOverlap <= 0) {
          continue;
        }

        await pushImpact({
          task,
          employee: {
            id: employee.id,
            name: employee.name,
            userId: employee.userId,
            leaveRecords: employee.leaveRecords,
          },
          allocationBackup: allocation,
          leave,
          overlapDays: allocationLeaveOverlap,
          isCriticalAllocation: true,
          allocationId: allocation.id,
        });
      }
    }

    return impacts;
  }

  private mapImpactRow(
    impact: ImpactCandidate,
    projectName: string,
  ): LeaveImpactRowDto {
    const hasBackup = this.impactHasBackup(impact);

    return {
      id: `${impact.task.id}:${impact.leave.from}:${impact.leave.to}`,
      projectId: impact.task.projectId,
      projectName,
      assignee: {
        employeeId: impact.employee.id,
        name: impact.employee.name,
        userId: impact.employee.userId,
        backupEmployeeId:
          impact.allocationBackup?.backupEmployeeId ?? null,
        backupEmployeeName:
          impact.allocationBackup?.backupEmployee?.name ?? null,
      },
      leave: {
        type: impact.leave.type,
        from: impact.leave.from,
        to: impact.leave.to,
        days: impact.leave.days,
      },
      task: {
        taskId: impact.task.id,
        title: impact.task.title,
        priority: impact.task.priority,
        isOnCriticalPath: impact.task.isOnCriticalPath,
        startDate: impact.task.startDate
          ? toDateKey(impact.task.startDate)
          : null,
        endDate: impact.task.endDate
          ? toDateKey(impact.task.endDate)
          : null,
        overlapDays: impact.overlapDays,
        estimatedDelayDays: impact.estimatedDelayDays,
        projectedTaskEnd: impact.projectedTaskEnd,
        downstreamTaskCount: impact.downstreamTaskCount,
        backupOwnerId: impact.task.backupOwnerId,
        backupOwnerName: impact.task.backupOwner?.displayName ?? null,
      },
      allocationId: impact.allocationId,
      hasBackup,
      isCritical: isTaskCritical(
        impact.task.priority,
        impact.task.isOnCriticalPath,
      ),
      isCriticalAllocation: impact.isCriticalAllocation,
    };
  }

  private allocationOverlapsLeave(
    allocation: { startDate: Date; endDate: Date | null },
    leave: LeaveRangeSummary,
  ): boolean {
    const allocFrom = toDateKey(allocation.startDate);
    const allocTo = allocation.endDate
      ? toDateKey(allocation.endDate)
      : addDaysToKey(allocFrom, 365);
    return rangesOverlap({ from: allocFrom, to: allocTo }, leave);
  }

  private async resolveBackupForImpact(impact: ImpactCandidate): Promise<{
    hasBackup: boolean;
    canApplyBackup: boolean;
    backupUserId: string | null;
    backupName: string | null;
  }> {
    const resolved = await this.resolveBackupUserForTask(impact.task, impact.allocationBackup);
    return {
      hasBackup: this.impactHasBackup(impact),
      canApplyBackup: Boolean(resolved.userId && resolved.userId !== impact.task.ownerId),
      backupUserId: resolved.userId,
      backupName: resolved.name,
    };
  }

  private async resolveBackupUserForTask(
    task: {
      id: string;
      projectId: string;
      ownerId: string | null;
      backupOwnerId: string | null;
      backupOwner?: { id: string; displayName: string } | null;
      owner?: { employees?: { id: string } | null } | null;
    },
    allocationBackup?: {
      backupEmployeeId: string | null;
      backupEmployee?: { id: string; name: string; userId?: string | null } | null;
    } | null,
  ): Promise<{ userId: string | null; name: string | null; source: 'task' | 'allocation' | null }> {
    if (task.backupOwnerId) {
      return {
        userId: task.backupOwnerId,
        name: task.backupOwner?.displayName ?? null,
        source: 'task',
      };
    }

    let allocation = allocationBackup;
    if (!allocation && task.owner?.employees?.id) {
      allocation = await this.prisma.allocation.findFirst({
        where: {
          projectId: task.projectId,
          employeeId: task.owner.employees.id,
          status: 'Active',
        },
        select: {
          backupEmployeeId: true,
          backupEmployee: { select: { id: true, name: true, userId: true } },
        },
      });
    }

    if (allocation?.backupEmployee?.userId) {
      return {
        userId: allocation.backupEmployee.userId,
        name: allocation.backupEmployee.name,
        source: 'allocation',
      };
    }

    return { userId: null, name: null, source: null };
  }

  private impactHasBackup(impact: ImpactCandidate): boolean {
    return Boolean(
      impact.task.backupOwnerId ||
        impact.allocationBackup?.backupEmployeeId,
    );
  }

  private async assertProjectInScope(
    projectId: string,
    caslUser: CaslUserContext,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        AND: [{ id: projectId }, this.recordScopeWhere.projectWhere(caslUser, 'read')],
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'notFound' },
      });
    }
  }
}
