import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { AllocationPolicyService } from '../settings/allocation-policy.service';
import { mapAllocationPoliciesDto } from '../settings/app-settings.service';
import {
  QueryTeamDirectoryDto,
  TeamDirectorySortField,
} from './dto/query-team-directory.dto';
import { QueryTeamLeaveDto, TeamLeaveSortField } from './dto/query-team-leave.dto';
import {
  QueryEmployeeAttendanceDto,
  EmployeeAttendanceSortField,
} from './dto/query-employee-attendance.dto';
import {
  DesignationOptionsDto,
  EmployeeAttendanceListResponseDto,
  EmployeeAttendanceRowDto,
  TeamDirectoryMemberDto,
  TeamDirectoryResponseDto,
  TeamDirectoryStatsDto,
  TeamLeaveListResponseDto,
  TeamLeaveRowDto,
} from './dto/team-directory.dto';
import {
  AdminDepartmentListResponseDto,
  QueryAdminDepartmentsDto,
} from './dto/admin-departments.dto';
import {
  buildAvailabilitySummary,
  allocationWeeklyHours,
  isAllocationOverlappingWindow,
  sumOverlappingAllocationHours,
} from '../projects/utils/allocation-availability.util';
import {
  filterLeaveInWindow,
  groupLeaveRecords,
} from '../projects/utils/leave-summary.util';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, code: true, name: true } },
  allocations: {
    where: { status: 'Active' },
    include: {
      project: { select: { id: true, name: true } },
    },
  },
  leaveRecords: {
    orderBy: { fromDate: 'asc' as const },
  },
} as const;

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

type UtilizationStatus = 'over' | 'optimal' | 'under' | 'available';

@Injectable()
export class TeamDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationPolicyService: AllocationPolicyService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async getDesignationOptions(
    caslUser: CaslUserContext,
  ): Promise<DesignationOptionsDto> {
    const employeeScope =
      this.recordScopeWhere.teamDirectoryEmployeeWhere(caslUser);
    const [employees, policies] = await Promise.all([
      this.prisma.employee.findMany({
        where: { AND: [{ isActive: true }, employeeScope] },
        select: { designation: true },
      }),
      this.allocationPolicyService.getPolicies(),
    ]);

    const fromEmployees = employees
      .map((row) => row.designation.trim())
      .filter((value) => value.length > 0);
    const fromRules = policies.designationRules.flatMap((rule) => [
      rule.projectRole,
      ...rule.allowedDesignations,
    ]);

    const options = [
      ...new Set(
        [...fromEmployees, ...fromRules]
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b));

    return { options };
  }

  async findDirectory(
    query: QueryTeamDirectoryDto,
    caslUser: CaslUserContext,
  ): Promise<TeamDirectoryResponseDto> {
    return this.buildDirectoryResponse(
      query,
      this.recordScopeWhere.teamDirectoryEmployeeWhere(caslUser),
    );
  }

  /** Admin Directory: all active employees (gated by User read, not Team scope). */
  async listAdminEmployees(
    query: QueryTeamDirectoryDto,
  ): Promise<TeamDirectoryResponseDto> {
    return this.buildDirectoryResponse(query, {});
  }

  private async buildDirectoryResponse(
    query: QueryTeamDirectoryDto,
    employeeScope: Prisma.EmployeeWhereInput,
  ): Promise<TeamDirectoryResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';
    const utilizationFilter = query.utilizationStatus ?? 'all';

    const planningWindow = this.resolvePlanningWindow(
      query.startDate,
      query.endDate,
    );

    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          { isActive: true },
          employeeScope,
          ...(query.departmentId ? [{ departmentId: query.departmentId }] : []),
          ...(query.search
            ? [
                {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' as const } },
                    { email: { contains: query.search, mode: 'insensitive' as const } },
                    {
                      designation: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      department: {
                        name: { contains: query.search, mode: 'insensitive' as const },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: EMPLOYEE_INCLUDE,
      orderBy: { name: 'asc' },
    });

    const leaveWindowStart = planningWindow?.start ?? new Date();
    const leaveWindowEnd =
      planningWindow?.end ??
      new Date(leaveWindowStart.getTime() + 90 * 24 * 60 * 60 * 1000);

    const allocationWindow =
      planningWindow ??
      ({ start: leaveWindowStart, end: leaveWindowEnd } as const);

    const allMembers = employees.map((employee) =>
      this.toDirectoryMember(
        employee,
        allocationWindow,
        leaveWindowStart,
        leaveWindowEnd,
      ),
    );

    const stats = this.computeStats(allMembers);

    const filtered =
      utilizationFilter === 'all'
        ? allMembers
        : allMembers.filter(
            (member) =>
              resolveUtilizationStatus(member) === utilizationFilter,
          );

    const sorted = sortDirectoryMembers(filtered, sortBy, sortOrder);
    const total = sorted.length;
    const start = (page - 1) * limit;
    const members = sorted.slice(start, start + limit);

    return {
      members,
      stats,
      policy: await this.getAllocationPolicy(),
      page,
      limit,
      total,
    };
  }

  async findLeave(
    query: QueryTeamLeaveDto,
    caslUser: CaslUserContext,
  ): Promise<TeamLeaveListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'from';
    const sortOrder = query.sortOrder ?? 'desc';

    const employeeScope = this.recordScopeWhere.teamDirectoryEmployeeWhere(caslUser);

    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          { isActive: true },
          employeeScope,
          { leaveRecords: { some: {} } },
          ...(query.search
            ? [
                {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' as const } },
                    { email: { contains: query.search, mode: 'insensitive' as const } },
                    {
                      designation: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      department: {
                        name: { contains: query.search, mode: 'insensitive' as const },
                      },
                    },
                    {
                      leaveRecords: {
                        some: {
                          leaveType: {
                            contains: query.search,
                            mode: 'insensitive' as const,
                          },
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
        department: { select: { name: true } },
        leaveRecords: { orderBy: { fromDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    let rows: TeamLeaveRowDto[] = employees.flatMap((employee) => {
      const history = groupLeaveRecords(employee.leaveRecords);
      return history.map((leave) => ({
        id: leave.id,
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department.name,
        designation: employee.designation,
        type: leave.type,
        from: leave.from,
        to: leave.to,
        days: leave.days,
        status: leave.status,
      }));
    });

    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.employeeName.toLowerCase().includes(q) ||
          row.designation.toLowerCase().includes(q) ||
          row.department.toLowerCase().includes(q) ||
          row.type.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q),
      );
    }

    const sorted = sortLeaveRows(rows, sortBy, sortOrder);
    const total = sorted.length;
    const start = (page - 1) * limit;

    return {
      rows: sorted.slice(start, start + limit),
      page,
      limit,
      total,
    };
  }

  async getAllocationPolicy() {
    return this.allocationPolicyService.getPolicies().then((policies) =>
      mapAllocationPoliciesDto(policies),
    );
  }

  private computeStats(members: TeamDirectoryMemberDto[]): TeamDirectoryStatsDto {
    const total = members.length;
    const over = members.filter(
      (member) => resolveUtilizationStatus(member) === 'over',
    ).length;
    const available = members.filter((member) => {
      const status = resolveUtilizationStatus(member);
      return status === 'available' || status === 'under';
    }).length;
    const avgUtil = total
      ? Math.round(
          members.reduce((sum, member) => sum + member.utilizationPercent, 0) /
            total,
        )
      : 0;

    return { total, over, available, avgUtil };
  }

  private toDirectoryMember(
    employee: EmployeeRow,
    allocationWindow: { start: Date; end: Date },
    leaveWindowStart: Date,
    leaveWindowEnd: Date,
  ): TeamDirectoryMemberDto {
    const weeklyCapacity = Number(employee.weeklyHours);
    const relevantAllocations = employee.allocations.filter((row) =>
      isAllocationOverlappingWindow(
        row,
        allocationWindow.start,
        allocationWindow.end,
      ),
    );

    const allocatedHoursTotal = sumOverlappingAllocationHours(
      relevantAllocations,
      weeklyCapacity,
      allocationWindow.start,
      allocationWindow.end,
    );

    const summary = buildAvailabilitySummary(weeklyCapacity, allocatedHoursTotal);
    const leaveHistory = groupLeaveRecords(employee.leaveRecords);
    const upcomingLeave = filterLeaveInWindow(
      leaveHistory,
      leaveWindowStart,
      leaveWindowEnd,
    );

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      designation: employee.designation,
      kekaEmployeeId: employee.kekaEmployeeId,
      profileImageUrl: employee.profileImageUrl,
      department: employee.department,
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocatedHoursTotal: summary.allocatedHours,
      remainingHours: summary.remainingHours,
      utilizationPercent: summary.utilizationPercent,
      isOverAllocated: summary.isOverAllocated,
      isFullyBooked: summary.isFullyBooked,
      projects: [...new Set(relevantAllocations.map((row) => row.project.name))],
      assignments: relevantAllocations.map((row) => ({
        projectId: row.projectId,
        project: row.project.name,
        role: row.role,
        hoursPerWeek: allocationWeeklyHours(row, weeklyCapacity),
        allocationPercent: row.percent != null ? Number(row.percent) : null,
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
        status: row.status,
      })),
      upcomingLeave,
      leaveHistory,
    };
  }

  private resolvePlanningWindow(
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } | undefined {
    if (!startDate || !endDate) {
      return undefined;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return undefined;
    }

    return start <= end ? { start, end } : undefined;
  }

  async findEmployeeAttendance(
    employeeId: string,
    query: QueryEmployeeAttendanceDto,
    caslUser: CaslUserContext,
  ): Promise<EmployeeAttendanceListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'attendanceDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const employeeScope = this.recordScopeWhere.teamDirectoryEmployeeWhere(caslUser);
    const employee = await this.prisma.employee.findFirst({
      where: {
        AND: [{ id: employeeId }, { isActive: true }, employeeScope],
      },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({
        status: 404,
        errors: { employee: 'employeeNotFound' },
      });
    }

    const searchFilters = this.buildAttendanceSearchFilters(query.search);

    const where: Prisma.AttendanceRecordWhereInput = {
      AND: [
        { employeeId },
        ...(query.dayType !== undefined ? [{ dayType: query.dayType }] : []),
        ...(query.fromDate || query.toDate
          ? [
              {
                attendanceDate: {
                  ...(query.fromDate
                    ? { gte: new Date(`${query.fromDate}T00:00:00.000Z`) }
                    : {}),
                  ...(query.toDate
                    ? { lte: new Date(`${query.toDate}T00:00:00.000Z`) }
                    : {}),
                },
              },
            ]
          : []),
        ...searchFilters,
      ],
    };

    const orderBy = this.buildAttendanceOrderBy(sortBy, sortOrder);

    const [total, rows, latestSync] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceRecord.findFirst({
        where: { employeeId },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    return {
      rows: rows.map((row) => this.toAttendanceRow(row)),
      page,
      limit,
      total,
      lastSuccessfulSyncAt: latestSync?.syncedAt.toISOString() ?? null,
    };
  }

  private buildAttendanceSearchFilters(
    search?: string,
  ): Prisma.AttendanceRecordWhereInput[] {
    const term = search?.trim();
    if (!term) {
      return [];
    }

    const or: Prisma.AttendanceRecordWhereInput[] = [
      { employeeNumber: { contains: term, mode: 'insensitive' } },
      { kekaEmployeeId: { contains: term, mode: 'insensitive' } },
      { kekaAttendanceId: { contains: term, mode: 'insensitive' } },
    ];

    const dayType = this.resolveAttendanceDayTypeSearch(term);
    if (dayType !== null) {
      or.push({ dayType });
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(term)) {
      or.push({
        attendanceDate: new Date(`${term}T00:00:00.000Z`),
      });
    } else if (/^\d{4}-\d{2}$/.test(term)) {
      const [year, month] = term.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      or.push({
        attendanceDate: { gte: start, lte: end },
      });
    }

    return [{ OR: or }];
  }

  private resolveAttendanceDayTypeSearch(term: string): number | null {
    const normalized = term.toLowerCase();
    if (normalized.includes('working') || normalized === 'work') return 0;
    if (normalized.includes('holiday')) return 1;
    if (normalized.includes('weekly') || normalized.includes('off')) return 2;
    if (normalized.includes('leave')) return 3;
    if (normalized.includes('unknown')) return 4;
    if (/^[0-4]$/.test(normalized)) return Number(normalized);
    return null;
  }

  private buildAttendanceOrderBy(
    sortBy: EmployeeAttendanceSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.AttendanceRecordOrderByWithRelationInput {
    switch (sortBy) {
      case 'dayType':
        return { dayType: sortOrder };
      case 'shiftStartTime':
        return { shiftStartTime: sortOrder };
      case 'shiftDuration':
        return { shiftDuration: sortOrder };
      case 'shiftEffectiveDuration':
        return { shiftEffectiveDuration: sortOrder };
      case 'totalEffectiveHours':
        return { totalEffectiveHours: sortOrder };
      case 'syncedAt':
        return { syncedAt: sortOrder };
      case 'attendanceDate':
      default:
        return { attendanceDate: sortOrder };
    }
  }

  private toAttendanceRow(row: {
    id: string;
    attendanceDate: Date;
    dayType: number | null;
    shiftStartTime: Date | null;
    shiftEndTime: Date | null;
    shiftDuration: Prisma.Decimal | null;
    shiftEffectiveDuration: Prisma.Decimal | null;
    totalEffectiveHours: Prisma.Decimal | null;
    totalGrossHours: Prisma.Decimal | null;
    firstInAt: Date | null;
    lastOutAt: Date | null;
    syncedAt: Date;
  }): EmployeeAttendanceRowDto {
    return {
      id: row.id,
      attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
      dayType: row.dayType,
      shiftStartTime: row.shiftStartTime?.toISOString() ?? null,
      shiftEndTime: row.shiftEndTime?.toISOString() ?? null,
      shiftDuration:
        row.shiftDuration != null ? Number(row.shiftDuration) : null,
      shiftEffectiveDuration:
        row.shiftEffectiveDuration != null
          ? Number(row.shiftEffectiveDuration)
          : null,
      totalEffectiveHours:
        row.totalEffectiveHours != null ? Number(row.totalEffectiveHours) : null,
      totalGrossHours:
        row.totalGrossHours != null ? Number(row.totalGrossHours) : null,
      firstInAt: row.firstInAt?.toISOString() ?? null,
      lastOutAt: row.lastOutAt?.toISOString() ?? null,
      syncedAt: row.syncedAt.toISOString(),
    };
  }

  async listAdminDepartments(
    query: QueryAdminDepartmentsDto,
  ): Promise<AdminDepartmentListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';
    const search = query.search?.trim();

    const where: Prisma.DepartmentWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { kekaDepartmentId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.department.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        kekaDepartmentId: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            employees: true,
            projects: true,
          },
        },
      },
    });

    const dir = sortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'code':
          cmp = a.code.localeCompare(b.code);
          break;
        case 'employeeCount':
          cmp = a._count.employees - b._count.employees;
          break;
        case 'createdAt':
          cmp = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'name':
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return cmp * dir;
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);

    return {
      data: pageRows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        kekaDepartmentId: row.kekaDepartmentId,
        isActive: row.isActive,
        employeeCount: row._count.employees,
        projectCount: row._count.projects,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}

function resolveUtilizationStatus(member: {
  isOverAllocated: boolean;
  utilizationPercent: number;
}): UtilizationStatus {
  if (member.isOverAllocated) return 'over';
  if (member.utilizationPercent >= 70) return 'optimal';
  if (member.utilizationPercent >= 40) return 'under';
  return 'available';
}

function sortDirectoryMembers(
  members: TeamDirectoryMemberDto[],
  sortBy: TeamDirectorySortField,
  sortOrder: 'asc' | 'desc',
): TeamDirectoryMemberDto[] {
  const dir = sortOrder === 'asc' ? 1 : -1;

  return [...members].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'designation':
        cmp = a.designation.localeCompare(b.designation);
        break;
      case 'department':
        cmp = a.department.name.localeCompare(b.department.name);
        break;
      case 'utilization':
        cmp = a.utilizationPercent - b.utilizationPercent;
        break;
      case 'allocatedHours':
        cmp = a.allocatedHoursTotal - b.allocatedHoursTotal;
        break;
      case 'remainingHours':
        cmp = a.remainingHours - b.remainingHours;
        break;
      default:
        cmp = a.name.localeCompare(b.name);
    }
    return cmp * dir;
  });
}

function sortLeaveRows(
  rows: TeamLeaveRowDto[],
  sortBy: TeamLeaveSortField,
  sortOrder: 'asc' | 'desc',
): TeamLeaveRowDto[] {
  const dir = sortOrder === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'employeeName':
        cmp = a.employeeName.localeCompare(b.employeeName);
        break;
      case 'department':
        cmp = a.department.localeCompare(b.department);
        break;
      case 'type':
        cmp = a.type.localeCompare(b.type);
        break;
      case 'from':
        cmp = a.from.localeCompare(b.from);
        break;
      case 'days':
        cmp = a.days - b.days;
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      default:
        cmp = a.from.localeCompare(b.from);
    }
    return cmp * dir;
  });
}
