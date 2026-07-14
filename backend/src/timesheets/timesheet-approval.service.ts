import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { TimesheetPushService } from '../integrations/keka/sync/timesheet-push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../database/prisma.service';
import {
  QueryTimesheetApprovalsDto,
  ApproveTimesheetSubmissionDto,
  RejectTimesheetSubmissionDto,
  TimesheetApprovalDecisionDto,
  TimesheetApprovalListResponseDto,
  TimesheetSubmissionRowDto,
  TimesheetSyncFailureDto,
  RetryTimesheetSyncResultDto,
} from './dto/timesheet-approval.dto';
import {
  TIMESHEET_DAILY_THRESHOLD_HOURS,
  TIMESHEET_ESCALATION_DAYS,
  TIMESHEET_STATUS,
} from './timesheets.constants';
import {
  notifyTimesheetApproved,
  notifyTimesheetRejected,
} from './timesheet-notifications.util';
import {
  addDays,
  formatDateOnly,
  formatWeekLabel,
  getWeekEnd,
  getWeekStart,
  parseDateOnly,
} from './utils/week.util';

const TIMESHEET_APPROVAL_INCLUDE = {
  employee: {
    select: {
      id: true,
      name: true,
      designation: true,
      userId: true,
    },
  },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  approvals: {
    orderBy: { decidedAt: 'desc' as const },
    take: 5,
    select: { comment: true, decision: true, kekaSyncRef: true },
  },
} as const;

type TimesheetRow = Prisma.TimesheetGetPayload<{
  include: typeof TIMESHEET_APPROVAL_INCLUDE;
}>;

@Injectable()
export class TimesheetApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly timesheetPushService: TimesheetPushService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findSubmissions(
    query: QueryTimesheetApprovalsDto,
    caslUser: CaslUserContext,
  ): Promise<TimesheetApprovalListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const statusFilter = query.status ?? 'all';
    const projectWhere = this.recordScopeWhere.timesheetApprovalProjectWhere(caslUser);

    const rows = await this.prisma.timesheet.findMany({
      where: {
        status: {
          in: [
            TIMESHEET_STATUS.SUBMITTED,
            TIMESHEET_STATUS.APPROVED,
            TIMESHEET_STATUS.REJECTED,
          ],
        },
        project: projectWhere,
      },
      include: TIMESHEET_APPROVAL_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }],
    });

    const grouped = this.groupSubmissions(rows);
    const filtered = grouped.filter((submission) => {
      const matchesStatus =
        statusFilter === 'all' || submission.status === statusFilter;
      const matchesSearch = this.matchesSearch(submission, query.search);
      return matchesStatus && matchesSearch;
    });

    const stats = {
      pending: grouped.filter((row) => row.status === 'pending').length,
      approved: grouped.filter((row) => row.status === 'approved').length,
      rejected: grouped.filter((row) => row.status === 'rejected').length,
      escalated: grouped.filter((row) => row.isEscalated).length,
      overThreshold: grouped.filter(
        (row) => row.isOverThreshold && row.status === 'pending',
      ).length,
    };

    const total = filtered.length;
    const start = (page - 1) * limit;

    return {
      rows: filtered.slice(start, start + limit),
      page,
      limit,
      total,
      stats,
    };
  }

  async approveSubmission(
    dto: ApproveTimesheetSubmissionDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<TimesheetApprovalDecisionDto> {
    const entries = await this.getActionableEntries(
      dto.employeeId,
      dto.weekStart,
      caslUser,
    );

    if (entries[0].employee.userId === actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { timesheet: 'cannotApproveOwnSubmission' },
      });
    }

    const approveComment = dto.comment?.trim() || null;
    const kekaSyncRefs: string[] = [];
    const syncFailures: string[] = [];
    const approvalsToPush: { timesheetId: string; approvalId: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.timesheet.update({
          where: { id: entry.id },
          data: { status: TIMESHEET_STATUS.APPROVED },
        });

        const approval = await tx.timesheetApproval.create({
          data: {
            timesheetId: entry.id,
            reviewerId: actorId,
            decision: 'Approved',
            comment: approveComment,
          },
        });

        approvalsToPush.push({
          timesheetId: entry.id,
          approvalId: approval.id,
        });
      }
    });

    for (const item of approvalsToPush) {
      const ref = await this.timesheetPushService.pushTimesheetEntry(
        item.timesheetId,
        item.approvalId,
      );
      if (ref) {
        kekaSyncRefs.push(ref);
      } else {
        syncFailures.push(item.timesheetId);
      }
    }

    const employeeUserId = entries[0].employee.userId;
    if (employeeUserId) {
      const reviewer = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { displayName: true },
      });

      await notifyTimesheetApproved(this.notificationsService, {
        recipientUserId: employeeUserId,
        weekStart: dto.weekStart,
        entryCount: entries.length,
        reviewerName: reviewer?.displayName ?? 'Reviewer',
        actorId,
        comment: approveComment,
      });
    }

    return {
      employeeId: dto.employeeId,
      weekStart: dto.weekStart,
      updatedCount: entries.length,
      kekaSyncRefs,
      syncFailures,
      syncSuccessCount: kekaSyncRefs.length,
    };
  }

  async rejectSubmission(
    dto: RejectTimesheetSubmissionDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<TimesheetApprovalDecisionDto> {
    const entries = await this.getActionableEntries(
      dto.employeeId,
      dto.weekStart,
      caslUser,
    );

    if (entries[0].employee.userId === actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { timesheet: 'cannotRejectOwnSubmission' },
      });
    }

    const comment = dto.comment?.trim() || 'Rejected by reviewer.';

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.timesheet.update({
          where: { id: entry.id },
          data: { status: TIMESHEET_STATUS.REJECTED },
        });

        await tx.timesheetApproval.create({
          data: {
            timesheetId: entry.id,
            reviewerId: actorId,
            decision: 'Rejected',
            comment,
          },
        });
      }
    });

    const employeeUserId = entries[0].employee.userId;
    if (employeeUserId) {
      const reviewer = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { displayName: true },
      });

      await notifyTimesheetRejected(this.notificationsService, {
        recipientUserId: employeeUserId,
        weekStart: dto.weekStart,
        entryCount: entries.length,
        reviewerName: reviewer?.displayName ?? 'Reviewer',
        comment,
        actorId,
      });
    }

    return {
      employeeId: dto.employeeId,
      weekStart: dto.weekStart,
      updatedCount: entries.length,
      kekaSyncRefs: [],
      syncFailures: [],
      syncSuccessCount: 0,
    };
  }

  async listSyncFailures(): Promise<TimesheetSyncFailureDto[]> {
    return this.timesheetPushService.listSyncFailures();
  }

  async retrySync(
    timesheetId: string,
    actorId: string,
  ): Promise<RetryTimesheetSyncResultDto> {
    return this.timesheetPushService.retryTimesheetSync(timesheetId, actorId);
  }

  private async getActionableEntries(
    employeeId: string,
    weekStartInput: string,
    caslUser: CaslUserContext,
  ): Promise<TimesheetRow[]> {
    const weekStart = getWeekStart(parseDateOnly(weekStartInput));
    const weekEnd = getWeekEnd(weekStart);
    const projectWhere = this.recordScopeWhere.timesheetApprovalProjectWhere(caslUser);

    const entries = await this.prisma.timesheet.findMany({
      where: {
        employeeId,
        status: TIMESHEET_STATUS.SUBMITTED,
        workDate: { gte: weekStart, lte: weekEnd },
        project: projectWhere,
      },
      include: TIMESHEET_APPROVAL_INCLUDE,
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    });

    if (entries.length === 0) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { submission: 'pendingSubmissionNotFound' },
      });
    }

    return entries;
  }

  private groupSubmissions(rows: TimesheetRow[]): TimesheetSubmissionRowDto[] {
    const groups = new Map<string, TimesheetRow[]>();

    for (const row of rows) {
      const weekStart = formatDateOnly(getWeekStart(row.workDate));
      const key = `${row.employeeId}:${weekStart}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const submissions: TimesheetSubmissionRowDto[] = [];

    for (const [key, entries] of groups) {
      const [employeeId, weekStart] = key.split(':');
      const weekStartDate = parseDateOnly(weekStart);
      const weekEndDate = getWeekEnd(weekStartDate);
      const status = this.resolveGroupStatus(entries);
      const submittedAt = this.latestTimestamp(entries);
      const { totalHours, billableHours } = this.sumEntryHours(entries);
      const rejection = entries
        .flatMap((entry) => entry.approvals)
        .find((approval) => approval.decision === 'Rejected');
      const mappedEntries = entries.map((entry) => ({
        id: entry.id,
        date: formatDateOnly(entry.workDate),
        project: entry.project.name,
        task: entry.task.title,
        hours:
          Number(entry.regularHours) + Number(entry.overtimeHours),
        description: entry.notes,
        kekaSyncStatus: this.resolveKekaSyncStatus(entry),
      }));
      const failedSyncCount = mappedEntries.filter(
        (entry) => entry.kekaSyncStatus === 'failed',
      ).length;

      submissions.push({
        id: key,
        employeeId,
        employee: entries[0].employee.name,
        employeeInitials: this.toInitials(entries[0].employee.name),
        employeeRole: entries[0].employee.designation,
        weekStart,
        week: formatWeekLabel(weekStartDate, weekEndDate),
        submittedAt: submittedAt.toISOString(),
        totalHours,
        billableHours,
        status,
        isOverThreshold: this.isWeekOverThreshold(entries, weekStartDate),
        isEscalated: this.isEscalated(status, submittedAt),
        hasSyncFailures: failedSyncCount > 0,
        failedSyncCount,
        entries: mappedEntries,
        feedback: rejection?.comment ?? null,
      });
    }

    return submissions.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  }

  private resolveGroupStatus(
    entries: TimesheetRow[],
  ): 'pending' | 'approved' | 'rejected' {
    const statuses = new Set(entries.map((entry) => entry.status));

    if (statuses.has(TIMESHEET_STATUS.SUBMITTED)) {
      return 'pending';
    }
    if (statuses.has(TIMESHEET_STATUS.REJECTED)) {
      return 'rejected';
    }
    return 'approved';
  }

  private latestTimestamp(entries: TimesheetRow[]) {
    return entries.reduce(
      (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
      entries[0].updatedAt,
    );
  }

  private sumEntryHours(entries: TimesheetRow[]) {
    return entries.reduce(
      (acc, entry) => {
        const hours =
          Number(entry.regularHours) + Number(entry.overtimeHours);
        acc.totalHours += hours;
        if (entry.isBillable) {
          acc.billableHours += hours;
        }
        return acc;
      },
      { totalHours: 0, billableHours: 0 },
    );
  }

  private isWeekOverThreshold(
    entries: TimesheetRow[],
    weekStart: Date,
  ): boolean {
    for (let offset = 0; offset < 5; offset += 1) {
      const dateKey = formatDateOnly(addDays(weekStart, offset));
      const dayTotal = entries
        .filter((entry) => formatDateOnly(entry.workDate) === dateKey)
        .reduce(
          (sum, entry) =>
            sum + Number(entry.regularHours) + Number(entry.overtimeHours),
          0,
        );

      if (dayTotal > TIMESHEET_DAILY_THRESHOLD_HOURS) {
        return true;
      }
    }

    return false;
  }

  private isEscalated(
    status: 'pending' | 'approved' | 'rejected',
    submittedAt: Date,
  ) {
    if (status !== 'pending') {
      return false;
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - TIMESHEET_ESCALATION_DAYS);
    return submittedAt < threshold;
  }

  private resolveKekaSyncStatus(
    entry: TimesheetRow,
  ): 'synced' | 'failed' | null {
    if (entry.status !== TIMESHEET_STATUS.APPROVED) {
      return null;
    }

    const approval = entry.approvals.find(
      (row) => row.decision === 'Approved',
    );

    return approval?.kekaSyncRef ? 'synced' : 'failed';
  }

  private matchesSearch(
    submission: TimesheetSubmissionRowDto,
    search?: string,
  ) {
    if (!search?.trim()) {
      return true;
    }

    const query = search.trim().toLowerCase();
    return (
      submission.employee.toLowerCase().includes(query) ||
      submission.week.toLowerCase().includes(query) ||
      submission.employeeRole.toLowerCase().includes(query)
    );
  }

  private toInitials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
