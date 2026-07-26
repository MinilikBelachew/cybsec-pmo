import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { TimesheetReconcileService } from '../integrations/keka/sync/timesheet-reconcile.service';
import { TIMESHEET_STATUS } from '../timesheets/timesheets.constants';
import {
  allocationWeeklyHours,
  isAllocationOverlappingWindow,
} from '../projects/utils/allocation-availability.util';
import { QueryUtilisationDto } from './dto/query-utilisation.dto';
import {
  UtilisationDepartmentBreakdownDto,
  UtilisationEmployeeRowDto,
  UtilisationReportResponseDto,
  UtilisationSummaryDto,
} from './dto/utilisation-response.dto';
import {
  countApprovedLeaveDays,
  countWorkingDays,
  eachDayInRange,
  formatDateOnly,
  isWeekday,
  parseDateOnly,
  resolveUtilisationStatus,
  roundHours,
  stripDate,
  sumTimesheetHours,
} from './utils/utilisation-period.util';

export const UTILISATION_FORMULA_VERSION = 'cybsec-2026-v1';

@Injectable()
export class UtilisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly timesheetReconcileService: TimesheetReconcileService,
  ) {}

  async getUtilisationReport(
    query: QueryUtilisationDto,
    caslUser: CaslUserContext,
  ): Promise<UtilisationReportResponseDto> {
    const { start, end } = this.resolvePeriod(query.startDate, query.endDate);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const employeeScope = this.recordScopeWhere.reportsEmployeeWhere(caslUser);
    const reporteeIds = query.managerEmployeeId
      ? await this.resolveReporteeEmployeeIds(query.managerEmployeeId)
      : null;

    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          { isActive: true },
          employeeScope,
          ...(query.employeeId ? [{ id: query.employeeId }] : []),
          ...(query.departmentId ? [{ departmentId: query.departmentId }] : []),
          ...(reporteeIds ? [{ id: { in: reporteeIds } }] : []),
          ...(query.search
            ? [
                {
                  OR: [
                    {
                      name: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      designation: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      department: {
                        name: {
                          contains: query.search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        department: { select: { id: true, name: true } },
        allocations: {
          where: { status: 'Active' },
        },
        leaveRecords: {
          where: {
            isApproved: true,
            fromDate: { lte: end },
            toDate: { gte: start },
          },
        },
        timesheets: {
          where: {
            workDate: { gte: start, lte: end },
            ...(query.projectId ? { projectId: query.projectId } : {}),
          },
          include: {
            approvals: {
              orderBy: { decidedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const remote = await this.timesheetReconcileService.getRemoteHoursByEmployeeId({
      start,
      end,
      employeeIds: employees.map((employee) => employee.id),
      projectId: query.projectId,
    });

    const allRows = employees.map((employee) =>
      this.buildEmployeeRow(
        employee,
        start,
        end,
        query.projectId,
        remote.source,
        remote.hoursByEmployeeId.get(employee.id) ?? 0,
        Boolean(employee.kekaEmployeeId),
      ),
    );

    const sorted = this.sortRows(allRows, sortBy, sortOrder);
    const total = sorted.length;
    const startIndex = (page - 1) * limit;
    const rows = sorted.slice(startIndex, startIndex + limit);
    const summary = this.buildSummary(allRows);
    const departments = this.buildDepartmentBreakdown(allRows);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
      formulaVersion: UTILISATION_FORMULA_VERSION,
      summary,
      rows,
      departments,
      page,
      limit,
      total,
      reconcileSource: remote.source,
    };
  }

  private buildEmployeeRow(
    employee: {
      id: string;
      userId: string | null;
      name: string;
      designation: string;
      weeklyHours: Prisma.Decimal;
      department: { id: string; name: string };
      allocations: Array<{
        percent: Prisma.Decimal | null;
        hours: Prisma.Decimal | null;
        status: string;
        startDate: Date;
        endDate: Date | null;
        projectId: string;
      }>;
      leaveRecords: Array<{ fromDate: Date; toDate: Date }>;
      timesheets: Array<{
        status: string;
        regularHours: Prisma.Decimal;
        overtimeHours: Prisma.Decimal;
        isBillable: boolean;
        approvals: Array<{ kekaSyncedAt: Date | null }>;
      }>;
    },
    start: Date,
    end: Date,
    projectId: string | undefined,
    reconcileSource: 'keka-live' | 'local-push-ack',
    kekaRemoteHoursInput: number,
    hasKekaLink: boolean,
  ): UtilisationEmployeeRowDto {
    const weeklyCapacity = Number(employee.weeklyHours);
    const dailyCapacity = weeklyCapacity / 5;
    const workingDays = countWorkingDays(start, end);
    const leaveDays = countApprovedLeaveDays(employee.leaveRecords, start, end);
    const availableHours = roundHours(
      Math.max(0, workingDays * dailyCapacity - leaveDays * dailyCapacity),
    );

    const allocations = projectId
      ? employee.allocations.filter((row) => row.projectId === projectId)
      : employee.allocations;

    const plannedHours = this.sumPlannedHours(
      allocations,
      weeklyCapacity,
      start,
      end,
    );

    let submittedHours = 0;
    let approvedHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let kekaSyncedHours = 0;

    for (const entry of employee.timesheets) {
      const hours = sumTimesheetHours(
        Number(entry.regularHours),
        Number(entry.overtimeHours),
      );

      if (entry.status === TIMESHEET_STATUS.SUBMITTED) {
        submittedHours += hours;
      }

      if (entry.status === TIMESHEET_STATUS.APPROVED) {
        approvedHours += hours;
        if (entry.isBillable) {
          billableHours += hours;
        } else {
          nonBillableHours += hours;
        }

        const latestApproval = entry.approvals[0];
        if (latestApproval?.kekaSyncedAt) {
          kekaSyncedHours += hours;
        }
      }
    }

    submittedHours = roundHours(submittedHours);
    approvedHours = roundHours(approvedHours);
    billableHours = roundHours(billableHours);
    nonBillableHours = roundHours(nonBillableHours);
    kekaSyncedHours = roundHours(kekaSyncedHours);
    const kekaRemoteHours = roundHours(kekaRemoteHoursInput);

    const billableUtilisationPercent =
      availableHours > 0
        ? Math.round((billableHours / availableHours) * 100)
        : 0;
    const totalUtilisationPercent =
      availableHours > 0
        ? Math.round((approvedHours / availableHours) * 100)
        : 0;

    const reconcile = this.resolveReconcile({
      source: reconcileSource,
      hasKekaLink,
      approvedHours,
      kekaRemoteHours,
      kekaSyncedHours,
    });

    return {
      employeeId: employee.id,
      userId: employee.userId,
      name: employee.name,
      designation: employee.designation,
      departmentId: employee.department.id,
      departmentName: employee.department.name,
      plannedHours,
      submittedHours,
      approvedHours,
      billableHours,
      nonBillableHours,
      availableHours,
      billableUtilisationPercent,
      totalUtilisationPercent,
      status: resolveUtilisationStatus(billableUtilisationPercent),
      reconcile,
    };
  }

  private resolveReconcile(input: {
    source: 'keka-live' | 'local-push-ack';
    hasKekaLink: boolean;
    approvedHours: number;
    kekaRemoteHours: number;
    kekaSyncedHours: number;
  }): UtilisationEmployeeRowDto['reconcile'] {
    const deltaHours =
      input.source === 'keka-live'
        ? roundHours(input.approvedHours - input.kekaRemoteHours)
        : roundHours(input.approvedHours - input.kekaSyncedHours);

    let status: 'matched' | 'pending' | 'mismatch' | 'unavailable' = 'matched';

    if (!input.hasKekaLink) {
      status = input.approvedHours > 0 ? 'unavailable' : 'matched';
    } else if (input.source === 'keka-live') {
      if (Math.abs(deltaHours) <= 0.01) {
        status = 'matched';
      } else if (
        input.kekaRemoteHours === 0 &&
        input.approvedHours > 0 &&
        input.kekaSyncedHours === 0
      ) {
        status = 'pending';
      } else {
        status = 'mismatch';
      }
    } else if (input.approvedHours === 0 && input.kekaSyncedHours === 0) {
      status = 'matched';
    } else if (input.kekaSyncedHours === 0 && input.approvedHours > 0) {
      status = 'pending';
    } else if (Math.abs(deltaHours) > 0.01) {
      status = 'mismatch';
    }

    return {
      approvedHours: input.approvedHours,
      kekaSyncedHours: input.kekaSyncedHours,
      kekaRemoteHours: input.kekaRemoteHours,
      deltaHours,
      status,
      source: input.source,
    };
  }

  private sumPlannedHours(
    allocations: Array<{
      percent: Prisma.Decimal | null;
      hours: Prisma.Decimal | null;
      status: string;
      startDate: Date;
      endDate: Date | null;
    }>,
    weeklyCapacity: number,
    start: Date,
    end: Date,
  ): number {
    let total = 0;

    for (const day of eachDayInRange(start, end)) {
      if (!isWeekday(day)) {
        continue;
      }

      for (const allocation of allocations) {
        if (
          !isAllocationOverlappingWindow(allocation, day, day) ||
          allocation.status !== 'Active'
        ) {
          continue;
        }

        total += allocationWeeklyHours(allocation, weeklyCapacity) / 5;
      }
    }

    return roundHours(total);
  }

  private buildSummary(rows: UtilisationEmployeeRowDto[]): UtilisationSummaryDto {
    const employeeCount = rows.length;
    const totalPlannedHours = roundHours(
      rows.reduce((sum, row) => sum + row.plannedHours, 0),
    );
    const totalSubmittedHours = roundHours(
      rows.reduce((sum, row) => sum + row.submittedHours, 0),
    );
    const totalApprovedHours = roundHours(
      rows.reduce((sum, row) => sum + row.approvedHours, 0),
    );
    const totalBillableHours = roundHours(
      rows.reduce((sum, row) => sum + row.billableHours, 0),
    );
    const totalNonBillableHours = roundHours(
      rows.reduce((sum, row) => sum + row.nonBillableHours, 0),
    );
    const totalAvailableHours = roundHours(
      rows.reduce((sum, row) => sum + row.availableHours, 0),
    );
    const avgBillableUtilisation =
      employeeCount > 0
        ? Math.round(
            rows.reduce((sum, row) => sum + row.billableUtilisationPercent, 0) /
              employeeCount,
          )
        : 0;

    return {
      employeeCount,
      avgBillableUtilisation,
      totalPlannedHours,
      totalSubmittedHours,
      totalApprovedHours,
      totalBillableHours,
      totalNonBillableHours,
      totalAvailableHours,
      overCount: rows.filter((row) => row.status === 'over').length,
      underCount: rows.filter((row) => row.status === 'under').length,
    };
  }

  private buildDepartmentBreakdown(
    rows: UtilisationEmployeeRowDto[],
  ): UtilisationDepartmentBreakdownDto[] {
    const byDept = new Map<string, UtilisationDepartmentBreakdownDto>();

    for (const row of rows) {
      const existing = byDept.get(row.departmentId);
      if (!existing) {
        byDept.set(row.departmentId, {
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          plannedHours: row.plannedHours,
          submittedHours: row.submittedHours,
          approvedHours: row.approvedHours,
          billableHours: row.billableHours,
          nonBillableHours: row.nonBillableHours,
          availableHours: row.availableHours,
        });
        continue;
      }

      existing.plannedHours = roundHours(existing.plannedHours + row.plannedHours);
      existing.submittedHours = roundHours(
        existing.submittedHours + row.submittedHours,
      );
      existing.approvedHours = roundHours(
        existing.approvedHours + row.approvedHours,
      );
      existing.billableHours = roundHours(
        existing.billableHours + row.billableHours,
      );
      existing.nonBillableHours = roundHours(
        existing.nonBillableHours + row.nonBillableHours,
      );
      existing.availableHours = roundHours(
        existing.availableHours + row.availableHours,
      );
    }

    return [...byDept.values()].sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }

  private sortRows(
    rows: UtilisationEmployeeRowDto[],
    sortBy: 'name' | 'billableUtilisation' | 'approvedHours',
    sortOrder: 'asc' | 'desc',
  ): UtilisationEmployeeRowDto[] {
    const direction = sortOrder === 'desc' ? -1 : 1;

    return [...rows].sort((left, right) => {
      if (sortBy === 'billableUtilisation') {
        return (
          (left.billableUtilisationPercent - right.billableUtilisationPercent) *
          direction
        );
      }
      if (sortBy === 'approvedHours') {
        return (left.approvedHours - right.approvedHours) * direction;
      }
      return left.name.localeCompare(right.name) * direction;
    });
  }

  private async resolveReporteeEmployeeIds(
    managerEmployeeId: string,
  ): Promise<string[]> {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, managerId: managerEmployeeId },
      select: { id: true },
    });

    return employees.map((row) => row.id);
  }

  private resolvePeriod(startDate?: string, endDate?: string) {
    const end = endDate ? parseDateOnly(endDate) : stripDate(new Date());
    const start = startDate
      ? parseDateOnly(startDate)
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

    if (start > end) {
      return { start: end, end: start };
    }

    return { start, end };
  }

  private formatDate(date: Date): string {
    return formatDateOnly(date);
  }
}
