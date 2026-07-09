import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  TIMESHEET_DAILY_MAX_HOURS,
  TIMESHEET_DAILY_THRESHOLD_HOURS,
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
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
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

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getContext(userId: string): Promise<TimesheetContextDto> {
    const employee = await this.requireEmployee(userId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const allocations = await this.prisma.allocation.findMany({
      where: {
        employeeId: employee.id,
        status: 'Active',
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { project: { name: 'asc' } },
    });

    const projectIds = [...new Set(allocations.map((row) => row.projectId))];
    const tasks = projectIds.length
      ? await this.prisma.task.findMany({
          where: {
            projectId: { in: projectIds },
            parentTaskId: null,
          },
          select: { id: true, title: true, projectId: true },
          orderBy: { title: 'asc' },
        })
      : [];

    const tasksByProject = new Map<string, { id: string; title: string }[]>();
    for (const task of tasks) {
      const list = tasksByProject.get(task.projectId) ?? [];
      list.push({ id: task.id, title: task.title });
      tasksByProject.set(task.projectId, list);
    }

    const seenProjects = new Set<string>();
    const projects = allocations
      .filter((allocation) => {
        if (seenProjects.has(allocation.projectId)) {
          return false;
        }
        seenProjects.add(allocation.projectId);
        return true;
      })
      .map((allocation) => ({
        id: allocation.project.id,
        name: allocation.project.name,
        tasks: tasksByProject.get(allocation.projectId) ?? [],
      }));

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
    const { totalHours, billableHours } = this.sumHours(mappedEntries);
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

    await this.assertProjectAccess(employee.id, dto.projectId, workDate);
    await this.assertTaskBelongsToProject(dto.taskId, dto.projectId);
    await this.assertDailyCapacity(employee.id, workDate, dto.hours);

    try {
      const created = await this.prisma.timesheet.create({
        data: {
          employeeId: employee.id,
          projectId: dto.projectId,
          taskId: dto.taskId,
          workDate,
          regularHours: dto.hours,
          overtimeHours: 0,
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

    const nextHours =
      dto.hours ?? this.entryTotalHours(existing.regularHours, existing.overtimeHours);

    if (dto.hours !== undefined) {
      await this.assertDailyCapacity(
        employee.id,
        existing.workDate,
        dto.hours,
        existing.id,
      );
    }

    const updated = await this.prisma.timesheet.update({
      where: { id: existing.id },
      data: {
        regularHours: nextHours,
        overtimeHours: 0,
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

    if (!allocation) {
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

  private mapEntry(row: TimesheetRow): TimesheetEntryDto {
    const rejection = row.approvals.find(
      (approval) => approval.decision === 'Rejected',
    );
    const approval = row.approvals.find(
      (approval) => approval.decision === 'Approved',
    );

    return {
      id: row.id,
      workDate: formatDateOnly(row.workDate),
      projectId: row.project.id,
      projectName: row.project.name,
      taskId: row.task.id,
      taskName: row.task.title,
      hours: this.entryTotalHours(row.regularHours, row.overtimeHours),
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
        if (entry.isBillable) {
          acc.billableHours += entry.hours;
        }
        return acc;
      },
      { totalHours: 0, billableHours: 0 },
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
        isBillable: row.isBillable,
        status: row.status,
        updatedAt: row.updatedAt,
      }));

      const { totalHours, billableHours } = mapped.reduce(
        (acc, row) => {
          acc.totalHours += row.hours;
          if (row.isBillable) {
            acc.billableHours += row.hours;
          }
          return acc;
        },
        { totalHours: 0, billableHours: 0 },
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
        status,
        submittedAt: submittedAt ? submittedAt.toISOString() : null,
        approvedBy: null,
      });
    }

    return cards;
  }
}
