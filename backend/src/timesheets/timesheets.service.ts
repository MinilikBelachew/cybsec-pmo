import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  notifyTimesheetSubmitted,
  resolveApproverUserIds,
} from './timesheet-notifications.util';
import {
  CreateTimesheetEntryDto,
  UpdateTimesheetEntryDto,
} from './dto/timesheet-mutation.dto';
import {
  SubmitTimesheetWeekResultDto,
  TimesheetContextDto,
  TimesheetDaySummaryDto,
  TimesheetEntryDto,
  TimesheetWeekResponseDto,
  TimesheetWeekSummaryCardDto,
} from './dto/timesheet-response.dto';
import {
  TIMESHEET_BLOCKED_TASK_STATUSES,
  TIMESHEET_DAILY_MAX_HOURS,
  TIMESHEET_DAILY_THRESHOLD_HOURS,
  TIMESHEET_LOGGABLE_PROJECT_STATUSES,
  TIMESHEET_STATUS,
} from './timesheets.constants';
import {
  addDays,
  formatDateOnly,
  formatDayTabLabel,
  formatWeekLabel,
  getWeekEnd,
  getWeekStart,
  parseDateOnly,
} from './utils/week.util';

const TIMESHEET_INCLUDE = {
  project: { select: { id: true, name: true, status: true } },
  task: { select: { id: true, title: true, status: true } },
  approvals: {
    orderBy: { decidedAt: 'desc' as const },
    take: 5,
    include: {
      reviewer: { select: { id: true, displayName: true } },
    },
  },
} as const;

type TimesheetRow = Prisma.TimesheetGetPayload<{
  include: typeof TIMESHEET_INCLUDE;
}>;

const LOGGABLE_PROJECT_STATUSES =
  TIMESHEET_LOGGABLE_PROJECT_STATUSES as readonly ProjectStatus[];

const BLOCKED_TASK_STATUSES =
  TIMESHEET_BLOCKED_TASK_STATUSES as readonly TaskStatus[];

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getContext(
    userId: string,
    asOfInput?: string,
  ): Promise<TimesheetContextDto> {
    const employee = await this.requireEmployee(userId);
    const asOf = asOfInput ? parseDateOnly(asOfInput) : new Date();
    asOf.setUTCHours(0, 0, 0, 0);

    const allocations = await this.prisma.allocation.findMany({
      where: {
        employeeId: employee.id,
        status: 'Active',
        startDate: { lte: asOf },
        OR: [{ endDate: null }, { endDate: { gte: asOf } }],
        project: {
          status: { in: [...LOGGABLE_PROJECT_STATUSES] },
        },
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
      },
      orderBy: { project: { name: 'asc' } },
    });

    // Also allow logging against projects where the user owns a top-level task
    // (task assignment alone should expose the project in Log Hours).
    const ownedTasks = await this.prisma.task.findMany({
      where: {
        ownerId: userId,
        parentTaskId: null,
        status: { notIn: [...BLOCKED_TASK_STATUSES] },
        project: {
          status: { in: [...LOGGABLE_PROJECT_STATUSES] },
        },
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { id: true, name: true, status: true } },
      },
      orderBy: { title: 'asc' },
    });

    const projectMap = new Map<
      string,
      { id: string; name: string; taskIds: Set<string>; tasks: { id: string; title: string }[] }
    >();

    for (const allocation of allocations) {
      if (!projectMap.has(allocation.projectId)) {
        projectMap.set(allocation.projectId, {
          id: allocation.project.id,
          name: allocation.project.name,
          taskIds: new Set(),
          tasks: [],
        });
      }
    }

    for (const task of ownedTasks) {
      let entry = projectMap.get(task.projectId);
      if (!entry) {
        entry = {
          id: task.project.id,
          name: task.project.name,
          taskIds: new Set(),
          tasks: [],
        };
        projectMap.set(task.projectId, entry);
      }
      if (!entry.taskIds.has(task.id)) {
        entry.taskIds.add(task.id);
        entry.tasks.push({ id: task.id, title: task.title });
      }
    }

    const projectIds = [...projectMap.keys()];
    if (projectIds.length) {
      const projectTasks = await this.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          parentTaskId: null,
          status: { notIn: [...BLOCKED_TASK_STATUSES] },
        },
        select: { id: true, title: true, projectId: true },
        orderBy: { title: 'asc' },
      });

      for (const task of projectTasks) {
        const entry = projectMap.get(task.projectId);
        if (!entry || entry.taskIds.has(task.id)) {
          continue;
        }
        entry.taskIds.add(task.id);
        entry.tasks.push({ id: task.id, title: task.title });
      }
    }

    const projects = [...projectMap.values()]
      .map(({ id, name, tasks }) => ({
        id,
        name,
        tasks: tasks.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      weeklyHours: Number(employee.weeklyHours),
      dailyThresholdHours: TIMESHEET_DAILY_THRESHOLD_HOURS,
      projects,
    };
  }

  async getWeek(
    userId: string,
    weekStartInput?: string,
  ): Promise<TimesheetWeekResponseDto> {
    const employee = await this.requireEmployee(userId);
    const weekStart = weekStartInput
      ? getWeekStart(parseDateOnly(weekStartInput))
      : getWeekStart(new Date());
    const weekEnd = getWeekEnd(weekStart);

    const entries = await this.prisma.timesheet.findMany({
      where: {
        employeeId: employee.id,
        workDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: TIMESHEET_INCLUDE,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });

    const mappedEntries = entries.map((row) => this.mapEntry(row));
    const days = this.buildDaySummaries(weekStart, mappedEntries);
    const { totalHours, billableHours, overtimeHours } =
      this.sumHours(mappedEntries);
    const recentWeeks = await this.buildRecentWeekSummaries(
      employee.id,
      weekStart,
    );

    return {
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      weekLabel: formatWeekLabel(weekStart, weekEnd),
      totalHours,
      billableHours,
      overtimeHours,
      days,
      entries: mappedEntries,
      recentWeeks,
    };
  }

  async createEntry(
    userId: string,
    dto: CreateTimesheetEntryDto,
  ): Promise<TimesheetEntryDto> {
    const employee = await this.requireEmployee(userId);
    const workDate = parseDateOnly(dto.workDate);
    const { regularHours, overtimeHours } = this.resolveHourSplit(dto);

    await this.assertProjectAccess(
      employee.id,
      dto.projectId,
      workDate,
      userId,
    );
    await this.assertTaskBelongsToProject(dto.taskId, dto.projectId);
    await this.assertProjectAndTaskLoggable(dto.projectId, dto.taskId);
    await this.assertDailyCapacity(
      employee.id,
      workDate,
      regularHours + overtimeHours,
    );

    try {
      const created = await this.prisma.timesheet.create({
        data: {
          employeeId: employee.id,
          projectId: dto.projectId,
          taskId: dto.taskId,
          workDate,
          regularHours,
          overtimeHours,
          notes: dto.notes?.trim() || null,
          isBillable: dto.isBillable ?? true,
          status: TIMESHEET_STATUS.DRAFT,
        },
        include: TIMESHEET_INCLUDE,
      });

      return this.mapEntry(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          errors: { taskId: 'duplicateTaskEntryForDay' },
        });
      }
      throw error;
    }
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateTimesheetEntryDto,
  ): Promise<TimesheetEntryDto> {
    const employee = await this.requireEmployee(userId);
    const existing = await this.requireOwnedEntry(entryId, employee.id);

    if (!this.isEditable(existing.status)) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { status: 'entryNotEditable' },
      });
    }

    await this.assertProjectAndTaskLoggable(
      existing.projectId,
      existing.taskId,
    );

    const hoursChanging =
      dto.hours !== undefined ||
      dto.regularHours !== undefined ||
      dto.overtimeHours !== undefined;

    const { regularHours, overtimeHours } = hoursChanging
      ? this.resolveHourSplit({
          hours: dto.hours,
          regularHours:
            dto.regularHours !== undefined
              ? dto.regularHours
              : dto.hours !== undefined
                ? undefined
                : Number(existing.regularHours),
          overtimeHours:
            dto.overtimeHours !== undefined
              ? dto.overtimeHours
              : dto.hours !== undefined
                ? undefined
                : Number(existing.overtimeHours),
        })
      : {
          regularHours: Number(existing.regularHours),
          overtimeHours: Number(existing.overtimeHours),
        };

    if (hoursChanging) {
      await this.assertDailyCapacity(
        employee.id,
        existing.workDate,
        regularHours + overtimeHours,
        existing.id,
      );
    }

    const updated = await this.prisma.timesheet.update({
      where: { id: existing.id },
      data: {
        regularHours,
        overtimeHours,
        notes:
          dto.notes !== undefined ? dto.notes.trim() || null : existing.notes,
        isBillable: dto.isBillable ?? existing.isBillable,
        status:
          existing.status === TIMESHEET_STATUS.REJECTED
            ? TIMESHEET_STATUS.DRAFT
            : existing.status,
      },
      include: TIMESHEET_INCLUDE,
    });

    return this.mapEntry(updated);
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const employee = await this.requireEmployee(userId);
    const existing = await this.requireOwnedEntry(entryId, employee.id);

    if (!this.isEditable(existing.status)) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { status: 'entryNotEditable' },
      });
    }

    await this.prisma.timesheet.delete({ where: { id: existing.id } });
  }

  async submitWeek(
    userId: string,
    weekStartInput: string,
  ): Promise<SubmitTimesheetWeekResultDto> {
    const employee = await this.requireEmployee(userId);
    const weekStart = getWeekStart(parseDateOnly(weekStartInput));
    const weekEnd = getWeekEnd(weekStart);

    const drafts = await this.prisma.timesheet.findMany({
      where: {
        employeeId: employee.id,
        status: TIMESHEET_STATUS.DRAFT,
        workDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: TIMESHEET_INCLUDE,
    });

    if (drafts.length === 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { week: 'noDraftEntriesToSubmit' },
      });
    }

    this.assertEntriesLoggableForSubmit(drafts);

    await this.prisma.timesheet.updateMany({
      where: {
        id: { in: drafts.map((row) => row.id) },
      },
      data: {
        status: TIMESHEET_STATUS.SUBMITTED,
      },
    });

    const submitted = await this.prisma.timesheet.findMany({
      where: {
        id: { in: drafts.map((row) => row.id) },
      },
      include: TIMESHEET_INCLUDE,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });

    await this.notifyApproversOfSubmission(
      userId,
      employee.name,
      weekStartInput,
      submitted,
      false,
    );

    return {
      submittedCount: submitted.length,
      entries: submitted.map((row) => this.mapEntry(row)),
    };
  }

  async resubmitWeek(
    userId: string,
    weekStartInput: string,
  ): Promise<SubmitTimesheetWeekResultDto> {
    const employee = await this.requireEmployee(userId);
    const weekStart = getWeekStart(parseDateOnly(weekStartInput));
    const weekEnd = getWeekEnd(weekStart);

    const rejected = await this.prisma.timesheet.findMany({
      where: {
        employeeId: employee.id,
        status: TIMESHEET_STATUS.REJECTED,
        workDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: TIMESHEET_INCLUDE,
    });

    if (rejected.length === 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { week: 'noRejectedEntriesToResubmit' },
      });
    }

    this.assertEntriesLoggableForSubmit(rejected);

    await this.prisma.timesheet.updateMany({
      where: {
        id: { in: rejected.map((row) => row.id) },
      },
      data: {
        status: TIMESHEET_STATUS.SUBMITTED,
      },
    });

    const resubmitted = await this.prisma.timesheet.findMany({
      where: {
        id: { in: rejected.map((row) => row.id) },
      },
      include: TIMESHEET_INCLUDE,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });

    await this.notifyApproversOfSubmission(
      userId,
      employee.name,
      weekStartInput,
      resubmitted,
      true,
    );

    return {
      submittedCount: resubmitted.length,
      entries: resubmitted.map((row) => this.mapEntry(row)),
    };
  }

  private async notifyApproversOfSubmission(
    actorId: string,
    employeeName: string,
    weekStart: string,
    entries: TimesheetRow[],
    resubmission: boolean,
  ) {
    const projectIds = [...new Set(entries.map((entry) => entry.projectId))];
    const recipientUserIds = await resolveApproverUserIds(
      this.notificationsService,
      projectIds,
    );

    if (recipientUserIds.length === 0) {
      return;
    }

    await notifyTimesheetSubmitted(this.notificationsService, {
      recipientUserIds,
      employeeName,
      weekStart,
      entryCount: entries.length,
      actorId,
      resubmission,
    });
  }

  private async requireEmployee(userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, isActive: true },
    });

    if (!employee) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { employee: 'employeeProfileNotFound' },
      });
    }

    return employee;
  }

  private async requireOwnedEntry(entryId: string, employeeId: string) {
    const entry = await this.prisma.timesheet.findFirst({
      where: { id: entryId, employeeId },
    });

    if (!entry) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { timesheet: 'entryNotFound' },
      });
    }

    return entry;
  }

  private async assertProjectAccess(
    employeeId: string,
    projectId: string,
    workDate: Date,
    userId: string,
  ) {
    const allocation = await this.prisma.allocation.findFirst({
      where: {
        employeeId,
        projectId,
        status: 'Active',
        startDate: { lte: workDate },
        OR: [{ endDate: null }, { endDate: { gte: workDate } }],
      },
    });

    if (allocation) {
      return;
    }

    const ownedTask = await this.prisma.task.findFirst({
      where: {
        projectId,
        ownerId: userId,
        parentTaskId: null,
      },
      select: { id: true },
    });

    if (!ownedTask) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { projectId: 'projectNotAllocated' },
      });
    }
  }

  private async assertTaskBelongsToProject(taskId: string, projectId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, parentTaskId: null },
      select: { id: true },
    });

    if (!task) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { taskId: 'taskNotInProject' },
      });
    }
  }

  /**
   * Block logging / editing against closed or inactive projects and Done tasks.
   */
  private async assertProjectAndTaskLoggable(
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const [project, task] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, status: true },
      }),
      this.prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, title: true, status: true, projectId: true },
      }),
    ]);

    if (!project) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { projectId: 'projectNotFound' },
      });
    }

    if (!task || task.projectId !== projectId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { taskId: 'taskNotInProject' },
      });
    }

    if (!LOGGABLE_PROJECT_STATUSES.includes(project.status)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          projectId: `Cannot log hours on project "${project.name}" because its status is not Active or At Risk.`,
        },
      });
    }

    if (BLOCKED_TASK_STATUSES.includes(task.status)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          taskId: `Cannot log hours on task "${task.title}" because it is Done.`,
        },
      });
    }
  }

  /** Re-check drafts/rejected rows before submit/resubmit. */
  private assertEntriesLoggableForSubmit(entries: TimesheetRow[]): void {
    for (const entry of entries) {
      const projectStatus = entry.project.status;
      const taskStatus = entry.task.status;
      const projectName = entry.project.name;
      const taskTitle = entry.task.title;

      if (!LOGGABLE_PROJECT_STATUSES.includes(projectStatus)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            week: `Cannot submit hours for project "${projectName}" because its status is not Active or At Risk.`,
          },
        });
      }

      if (BLOCKED_TASK_STATUSES.includes(taskStatus)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            week: `Cannot submit hours for task "${taskTitle}" because it is Done.`,
          },
        });
      }
    }
  }

  private async assertDailyCapacity(
    employeeId: string,
    workDate: Date,
    additionalHours: number,
    excludeEntryId?: string,
  ) {
    const rows = await this.prisma.timesheet.findMany({
      where: {
        employeeId,
        workDate,
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      select: { regularHours: true, overtimeHours: true },
    });

    const existingTotal = rows.reduce(
      (sum, row) => sum + this.entryTotalHours(row.regularHours, row.overtimeHours),
      0,
    );
    const nextTotal = existingTotal + additionalHours;

    if (nextTotal > TIMESHEET_DAILY_MAX_HOURS) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { hours: 'dailyHoursExceeded' },
      });
    }
  }

  private isEditable(status: string) {
    return (
      status === TIMESHEET_STATUS.DRAFT ||
      status === TIMESHEET_STATUS.REJECTED
    );
  }

  private entryTotalHours(
    regularHours: Prisma.Decimal | number,
    overtimeHours: Prisma.Decimal | number,
  ) {
    return Number(regularHours) + Number(overtimeHours);
  }

  private resolveHourSplit(dto: {
    hours?: number;
    regularHours?: number;
    overtimeHours?: number;
  }): { regularHours: number; overtimeHours: number } {
    const hasSplit =
      dto.regularHours !== undefined || dto.overtimeHours !== undefined;

    let regularHours: number;
    let overtimeHours: number;

    if (hasSplit) {
      regularHours = Number(dto.regularHours ?? 0);
      overtimeHours = Number(dto.overtimeHours ?? 0);
    } else if (dto.hours !== undefined) {
      regularHours = Number(dto.hours);
      overtimeHours = 0;
    } else {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { hours: 'hoursRequired' },
      });
    }

    if (
      !Number.isFinite(regularHours) ||
      !Number.isFinite(overtimeHours) ||
      regularHours < 0 ||
      overtimeHours < 0
    ) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { hours: 'invalidHours' },
      });
    }

    const total = regularHours + overtimeHours;
    if (total <= 0) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { hours: 'hoursMustBePositive' },
      });
    }
    if (total > TIMESHEET_DAILY_MAX_HOURS) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { hours: 'dailyMaxExceeded' },
      });
    }

    return {
      regularHours: Math.round(regularHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
    };
  }

  private mapEntry(row: TimesheetRow): TimesheetEntryDto {
    const rejection = row.approvals.find(
      (approval) => approval.decision === 'Rejected',
    );
    const approval = row.approvals.find(
      (approval) => approval.decision === 'Approved',
    );
    const regularHours = Number(row.regularHours);
    const overtimeHours = Number(row.overtimeHours);

    return {
      id: row.id,
      workDate: formatDateOnly(row.workDate),
      projectId: row.project.id,
      projectName: row.project.name,
      taskId: row.task.id,
      taskName: row.task.title,
      hours: this.entryTotalHours(regularHours, overtimeHours),
      regularHours,
      overtimeHours,
      notes: row.notes,
      isBillable: row.isBillable,
      status: row.status,
      feedback: rejection?.comment ?? null,
      approvedBy: approval?.reviewer.displayName ?? null,
    };
  }

  private buildDaySummaries(
    weekStart: Date,
    entries: TimesheetEntryDto[],
  ): TimesheetDaySummaryDto[] {
    const days: TimesheetDaySummaryDto[] = [];

    for (let offset = 0; offset < 5; offset += 1) {
      const date = addDays(weekStart, offset);
      const dateKey = formatDateOnly(date);
      const dayEntries = entries.filter((entry) => entry.workDate === dateKey);
      const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);

      days.push({
        date: dateKey,
        label: formatDayTabLabel(date),
        totalHours,
        isOverThreshold: totalHours > TIMESHEET_DAILY_THRESHOLD_HOURS,
      });
    }

    return days;
  }

  private sumHours(entries: TimesheetEntryDto[]) {
    return entries.reduce(
      (acc, entry) => {
        acc.totalHours += entry.hours;
        acc.overtimeHours += entry.overtimeHours;
        if (entry.isBillable) {
          acc.billableHours += entry.hours;
        }
        return acc;
      },
      { totalHours: 0, billableHours: 0, overtimeHours: 0 },
    );
  }

  private async buildRecentWeekSummaries(
    employeeId: string,
    currentWeekStart: Date,
  ): Promise<TimesheetWeekSummaryCardDto[]> {
    const cards: TimesheetWeekSummaryCardDto[] = [];

    for (let index = 0; index < 3; index += 1) {
      const weekStart = addDays(currentWeekStart, -7 * index);
      const weekEnd = getWeekEnd(weekStart);

      const rows = await this.prisma.timesheet.findMany({
        where: {
          employeeId,
          workDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        select: {
          status: true,
          regularHours: true,
          overtimeHours: true,
          isBillable: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const mapped = rows.map((row) => ({
        hours: this.entryTotalHours(row.regularHours, row.overtimeHours),
        overtimeHours: Number(row.overtimeHours),
        isBillable: row.isBillable,
        status: row.status,
        updatedAt: row.updatedAt,
      }));

      const { totalHours, billableHours, overtimeHours } = mapped.reduce(
        (acc, row) => {
          acc.totalHours += row.hours;
          acc.overtimeHours += row.overtimeHours;
          if (row.isBillable) {
            acc.billableHours += row.hours;
          }
          return acc;
        },
        { totalHours: 0, billableHours: 0, overtimeHours: 0 },
      );

      const statuses = new Set(mapped.map((row) => row.status));
      let status: TimesheetWeekSummaryCardDto['status'] = 'draft';
      if (statuses.size === 0) {
        status = 'draft';
      } else if (statuses.size === 1) {
        const only = [...statuses][0];
        if (only === TIMESHEET_STATUS.SUBMITTED) status = 'submitted';
        else if (only === TIMESHEET_STATUS.APPROVED) status = 'approved';
        else status = 'draft';
      } else {
        status = 'mixed';
      }

      const submittedAt =
        mapped.find((row) => row.status === TIMESHEET_STATUS.SUBMITTED)
          ?.updatedAt ?? null;

      cards.push({
        weekStart: formatDateOnly(weekStart),
        weekLabel: formatWeekLabel(weekStart, weekEnd),
        totalHours,
        billableHours,
        overtimeHours,
        status,
        submittedAt: submittedAt ? submittedAt.toISOString() : null,
        approvedBy: null,
      });
    }

    return cards;
  }
}
