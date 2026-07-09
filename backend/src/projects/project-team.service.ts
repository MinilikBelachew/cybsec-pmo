import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AllocationPolicyService } from '../settings/allocation-policy.service';
import { AllocationRuntimePolicies } from '../settings/allocation-policy.types';
import { mapAllocationPoliciesDto } from '../settings/app-settings.service';
import {
  evaluateStaffingPolicies,
  previewDepartmentStaffingAllowed,
} from '../settings/utils/allocation-policy.util';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { QueryTeamCandidatesDto } from './dto/query-team-candidates.dto';
import {
  CreateProjectTeamResultDto,
  ProjectAllocationDto,
  ProjectTaskAssigneeDto,
  TaskAssigneeAvailabilityDto,
  TeamCandidateDto,
  UpdateProjectTeamMemberResultDto,
} from './dto/project-allocation.dto';
import {
  buildAvailabilitySummary,
  isAllocationActive,
  isAllocationOverlappingWindow,
  sumActiveAllocationHours,
  sumOverlappingAllocationHours,
} from './utils/allocation-availability.util';
import { QueryTaskAssigneeAvailabilityDto } from './dto/query-task-assignee-availability.dto';
import {
  filterLeaveInWindow,
  groupLeaveRecords,
} from './utils/leave-summary.util';
import {
  isDateRangeOverlapping,
  taskWeeklyHoursFromEffort,
} from './utils/task-availability.util';
import { AllocationPolicySummaryDto } from './dto/project-allocation.dto';
import { AllocationPushService } from '../keka/sync/allocation-push.service';
import {
  AlignProjectAllocationsResultDto,
  AllocationDateIssuesResponseDto,
} from './dto/allocation-date-issues.dto';
import {
  buildAlignAllocationPreview,
  buildAllocationDateIssueMessages,
} from './utils/allocation-date-issues.util';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, code: true, name: true } },
  user: { select: { id: true } },
} as const;

type EmployeeWithAllocations = Prisma.EmployeeGetPayload<{
  include: {
    department: { select: { id: true; code: true; name: true } };
    user: { select: { id: true } };
    allocations: true;
  };
}>;

type EmployeeLeaveRecord = Prisma.LeaveRecordGetPayload<object>;

type ThresholdOutcome = {
  status: string;
  approvedBy: string | null;
  requestedBy: string | null;
  requestedAt: Date | null;
  warnings: string[];
};

type AllocationCreatePlan = {
  employee: EmployeeWithAllocations;
  dto: CreateAllocationDto;
  thresholdOutcome: ThresholdOutcome;
};

@Injectable()
export class ProjectTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly allocationPolicyService: AllocationPolicyService,
    private readonly allocationPushService: AllocationPushService,
  ) {}

  async findCandidates(
    query: QueryTeamCandidatesDto,
    caslUser: CaslUserContext,
  ): Promise<TeamCandidateDto[]> {
    let projectDepartmentCode = '';

    if (query.projectId) {
      await this.assertProjectInScope(query.projectId, caslUser, 'read');
      const project = await this.prisma.project.findUnique({
        where: { id: query.projectId },
        select: { department: { select: { code: true } } },
      });
      projectDepartmentCode = project?.department.code ?? '';
    }

    const policies = await this.allocationPolicyService.getPolicies();

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
                { designation: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        ...EMPLOYEE_INCLUDE,
        allocations: {
          where: { status: { in: ['Active', 'Pending'] } },
        },
        leaveRecords: {
          orderBy: { leaveDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const planningWindow = this.resolvePlanningWindow(
      query.startDate,
      query.endDate,
    );

    return employees.map((employee) =>
      this.toTeamCandidate(
        employee,
        query.projectId,
        planningWindow,
        policies,
        projectDepartmentCode,
      ),
    );
  }

  async findProjectTeam(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectAllocationDto[]> {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    const planningWindow =
      project.startDate && project.endDate
        ? { start: project.startDate, end: project.endDate }
        : undefined;

    const allocations = await this.prisma.allocation.findMany({
      where: { projectId, status: { in: ['Active', 'Pending'] } },
      include: {
        requester: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        backupEmployee: { select: { id: true, name: true } },
        employee: {
          include: {
            ...EMPLOYEE_INCLUDE,
            allocations: { where: { status: 'Active' } },
            leaveRecords: { orderBy: { leaveDate: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return allocations.map((allocation) =>
      this.toProjectAllocationDto(
        allocation.employee,
        allocation,
        projectId,
        planningWindow,
      ),
    );
  }

  async getAllocationDateIssues(
    projectId: string,
    caslUser: CaslUserContext,
    proposedStartDate?: string,
    proposedEndDate?: string,
  ): Promise<AllocationDateIssuesResponseDto> {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });

    if (!project?.startDate || !project.endDate) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { project: 'projectDatesRequired' },
      });
    }

    const projectStart = proposedStartDate
      ? new Date(proposedStartDate)
      : project.startDate;
    const projectEnd = proposedEndDate
      ? new Date(proposedEndDate)
      : project.endDate;

    if (projectStart > projectEnd) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { projectEndDate: 'endDateMustBeAfterStartDate' },
      });
    }

    const allocations = await this.prisma.allocation.findMany({
      where: {
        projectId,
        status: { in: ['Active', 'Pending'] },
      },
      include: {
        employee: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = allocations.map((allocation) => ({
      id: allocation.id,
      employeeName: allocation.employee.name,
      status: allocation.status,
      startDate: allocation.startDate,
      endDate: allocation.endDate,
    }));

    const issues = rows.flatMap((row) => {
      const { kinds, messages } = buildAllocationDateIssueMessages(
        row,
        projectStart,
        projectEnd,
      );
      if (kinds.length === 0) {
        return [];
      }
      return [
        {
          allocationId: row.id,
          employeeName: row.employeeName,
          startDate: row.startDate.toISOString().slice(0, 10),
          endDate: row.endDate
            ? row.endDate.toISOString().slice(0, 10)
            : null,
          kinds,
          messages,
        },
      ];
    });

    const alignPreview = buildAlignAllocationPreview(
      rows,
      projectStart,
      projectEnd,
    );

    return {
      projectStartDate: projectStart.toISOString().slice(0, 10),
      projectEndDate: projectEnd.toISOString().slice(0, 10),
      issues,
      alignPreview,
      hasIssues: issues.length > 0,
      canAlign: alignPreview.length > 0,
    };
  }

  async alignAllocationsToProjectDates(
    projectId: string,
    caslUser: CaslUserContext,
    proposedStartDate?: string,
    proposedEndDate?: string,
  ): Promise<AlignProjectAllocationsResultDto> {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    const previewResponse = await this.getAllocationDateIssues(
      projectId,
      caslUser,
      proposedStartDate,
      proposedEndDate,
    );

    if (previewResponse.alignPreview.length === 0) {
      return { updatedCount: 0, warnings: [] };
    }

    const warnings: string[] = [];

    for (const row of previewResponse.alignPreview) {
      await this.prisma.allocation.update({
        where: { id: row.allocationId },
        data: {
          startDate: new Date(row.proposedStartDate),
          endDate: row.proposedEndDate
            ? new Date(row.proposedEndDate)
            : null,
        },
      });
      warnings.push(
        `Aligned ${row.employeeName}: ${row.currentStartDate}${row.currentEndDate ? ` – ${row.currentEndDate}` : ''} → ${row.proposedStartDate} – ${row.proposedEndDate ?? 'open'}.`,
      );
    }

    return {
      updatedCount: previewResponse.alignPreview.length,
      warnings,
    };
  }

  async findTaskAssignees(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectTaskAssigneeDto[]> {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const allocations = await this.prisma.allocation.findMany({
      where: { projectId, status: 'Active' },
      include: {
        employee: {
          include: {
            department: { select: { id: true, code: true, name: true } },
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const assignees: ProjectTaskAssigneeDto[] = [];
    const seenUserIds = new Set<string>();

    for (const allocation of allocations) {
      const userId = allocation.employee.userId;
      const user = allocation.employee.user;
      if (!userId || !user) {
        continue;
      }

      if (seenUserIds.has(userId)) {
        continue;
      }

      seenUserIds.add(userId);
      assignees.push({
        userId,
        displayName: user.displayName,
        email: user.email,
        employeeId: allocation.employee.id,
        name: allocation.employee.name,
        designation: allocation.employee.designation,
        role: allocation.role,
        department: allocation.employee.department,
      });
    }

    return assignees.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async checkTaskAssigneeAvailability(
    projectId: string,
    query: QueryTaskAssigneeAvailabilityDto,
    caslUser: CaslUserContext,
  ): Promise<TaskAssigneeAvailabilityDto> {
    await this.assertProjectInScope(projectId, caslUser, 'read');
    return this.evaluateTaskAssigneeAvailability(projectId, query);
  }

  async evaluateTaskAssigneeAvailability(
    projectId: string,
    params: QueryTaskAssigneeAvailabilityDto,
  ): Promise<TaskAssigneeAvailabilityDto> {
    if (!params.ownerId) {
      return {
        canCheck: false,
        message: 'Select an assignee to check availability.',
        warnings: [],
      };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });

    if (!project) {
      return {
        canCheck: false,
        message: 'Project not found.',
        warnings: [],
      };
    }

    const employee = await this.prisma.employee.findFirst({
      where: { userId: params.ownerId, isActive: true },
      include: {
        allocations: { where: { status: 'Active' } },
      },
    });

    if (!employee) {
      return {
        canCheck: false,
        message: 'Assignee is not linked to an active employee record.',
        warnings: [],
      };
    }

    const windowStart = params.startDate
      ? new Date(params.startDate)
      : project.startDate;
    const windowEnd = params.endDate ? new Date(params.endDate) : project.endDate;

    if (!windowStart || !windowEnd) {
      return {
        canCheck: false,
        message: 'Set task start and end dates to check availability.',
        warnings: [],
      };
    }

    if (windowStart > windowEnd) {
      return {
        canCheck: false,
        message: 'End date must be after start date.',
        warnings: [],
      };
    }

    const weeklyCapacity = Number(employee.weeklyHours);
    const allocationHours = sumOverlappingAllocationHours(
      employee.allocations,
      weeklyCapacity,
      windowStart,
      windowEnd,
    );

    const otherTasks = await this.prisma.task.findMany({
      where: {
        ownerId: params.ownerId,
        startDate: { not: null },
        endDate: { not: null },
        effortHours: { not: null },
        status: { not: 'Done' },
        ...(params.excludeTaskId ? { id: { not: params.excludeTaskId } } : {}),
      },
      select: {
        startDate: true,
        endDate: true,
        effortHours: true,
      },
    });

    let otherTaskHours = 0;
    for (const task of otherTasks) {
      if (
        task.startDate &&
        task.endDate &&
        isDateRangeOverlapping(
          task.startDate,
          task.endDate,
          windowStart,
          windowEnd,
        )
      ) {
        otherTaskHours += taskWeeklyHoursFromEffort(
          Number(task.effortHours),
          task.startDate,
          task.endDate,
        );
      }
    }

    let thisTaskHours = 0;
    if (params.effortHours != null && params.effortHours > 0) {
      thisTaskHours = taskWeeklyHoursFromEffort(
        params.effortHours,
        windowStart,
        windowEnd,
      );
    }

    const totalAfter = allocationHours + otherTaskHours + thisTaskHours;
    const summary = buildAvailabilitySummary(weeklyCapacity, totalAfter);
    const warnings: string[] = [];

    if (summary.isOverAllocated) {
      warnings.push(
        `${employee.name} would be over-allocated (${summary.allocatedHours}h/week of ${weeklyCapacity}h/week capacity including this task).`,
      );
    }

    return {
      canCheck: true,
      employeeName: employee.name,
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocationHours: roundHours(allocationHours),
      otherTaskHours: roundHours(otherTaskHours),
      thisTaskHours: roundHours(thisTaskHours),
      allocatedHoursTotal: summary.allocatedHours,
      remainingHours: summary.remainingHours,
      utilizationPercent: summary.utilizationPercent,
      isOverAllocated: summary.isOverAllocated,
      warnings,
    };
  }

  async validateNewProjectAllocations(
    projectDto: Pick<CreateProjectDto, 'departmentId' | 'startDate' | 'endDate'>,
    allocations: CreateAllocationDto[],
    actorId: string,
  ): Promise<void> {
    if (!allocations.length) {
      return;
    }

    const department = await this.prisma.department.findUnique({
      where: { id: projectDto.departmentId },
      select: { code: true },
    });

    if (!department) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { departmentId: 'departmentNotFound' },
      });
    }

    const policies = await this.allocationPolicyService.getPolicies();
    const warnings: string[] = [];
    const seenEmployeeIds = new Set<string>();

    for (const dto of allocations) {
      if (seenEmployeeIds.has(dto.employeeId)) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          errors: { employeeId: 'duplicateEmployeeInTeamRequest' },
        });
      }
      seenEmployeeIds.add(dto.employeeId);

      await this.planAllocationCreate({
        dto,
        projectId: null,
        projectDepartmentCode: department.code,
        projectStart: new Date(projectDto.startDate),
        projectEnd: new Date(projectDto.endDate),
        actorId,
        policies,
        warnings,
      });
    }
  }

  async addMembers(
    projectId: string,
    allocations: CreateAllocationDto[],
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<CreateProjectTeamResultDto> {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        department: { select: { code: true } },
      },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    const warnings: string[] = [];
    const policies = await this.allocationPolicyService.getPolicies();
    const plans: AllocationCreatePlan[] = [];
    const seenEmployeeIds = new Set<string>();

    for (const dto of allocations) {
      if (seenEmployeeIds.has(dto.employeeId)) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          errors: { employeeId: 'duplicateEmployeeInTeamRequest' },
        });
      }
      seenEmployeeIds.add(dto.employeeId);

      plans.push(
        await this.planAllocationCreate({
          dto,
          projectId,
          projectDepartmentCode: project.department.code,
          projectStart: project.startDate,
          projectEnd: project.endDate,
          actorId,
          policies,
          warnings,
        }),
      );
    }

    const createdAllocations = await this.prisma.$transaction(async (tx) => {
      const rows: Array<
        Prisma.AllocationGetPayload<{
          include: {
            requester: { select: { id: true; displayName: true } };
            approver: { select: { id: true; displayName: true } };
            backupEmployee: { select: { id: true; name: true } };
            employee: {
              include: typeof EMPLOYEE_INCLUDE & {
                allocations: true;
              };
            };
          };
        }>
      > = [];

      for (const plan of plans) {
        const allocation = await tx.allocation.create({
          data: {
            projectId,
            employeeId: plan.dto.employeeId,
            role: plan.dto.role,
            hours: plan.dto.hours ?? null,
            percent: plan.dto.percent ?? null,
            startDate: new Date(plan.dto.startDate),
            endDate: plan.dto.endDate ? new Date(plan.dto.endDate) : null,
            status: plan.thresholdOutcome.status,
            approvedBy: plan.thresholdOutcome.approvedBy,
            requestedBy: plan.thresholdOutcome.requestedBy,
            requestedAt: plan.thresholdOutcome.requestedAt,
          },
          include: {
            requester: { select: { id: true, displayName: true } },
            approver: { select: { id: true, displayName: true } },
            backupEmployee: { select: { id: true, name: true } },
            employee: {
              include: {
                ...EMPLOYEE_INCLUDE,
                allocations: { where: { status: 'Active' } },
              },
            },
          },
        });
        rows.push(allocation);
      }

      return rows;
    });

    const created = createdAllocations.map((allocation) =>
      this.toProjectAllocationDto(allocation.employee, allocation, projectId),
    );

    for (const allocation of createdAllocations) {
      if (allocation.status === 'Active') {
        void this.allocationPushService.pushAllocation(allocation.id);
      }
    }

    return {
      created,
      warnings,
      policy: this.toPolicySummary(policies),
    };
  }

  private async planAllocationCreate(params: {
    dto: CreateAllocationDto;
    projectId: string | null;
    projectDepartmentCode: string;
    projectStart: Date;
    projectEnd: Date;
    actorId: string;
    policies: AllocationRuntimePolicies;
    warnings: string[];
  }): Promise<AllocationCreatePlan> {
    const {
      dto,
      projectId,
      projectDepartmentCode,
      projectStart,
      projectEnd,
      actorId,
      policies,
      warnings,
    } = params;

    this.validateAllocationInput(dto);

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, isActive: true },
      include: {
        ...EMPLOYEE_INCLUDE,
        allocations: {
          where: {
            status: 'Active',
            ...(projectId ? { projectId: { not: projectId } } : {}),
          },
        },
      },
    });

    if (!employee) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { employeeId: 'employeeNotFoundOrInactive' },
      });
    }

    if (projectId) {
      const existing = await this.prisma.allocation.findFirst({
        where: {
          projectId,
          employeeId: dto.employeeId,
          status: { in: ['Active', 'Pending'] },
        },
      });

      if (existing) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          errors: {
            employeeId: `${employee.name} is already on this project team${existing.status === 'Pending' ? ' (pending approval)' : ''}`,
          },
        });
      }
    }

    const weeklyCapacity = Number(employee.weeklyHours);
    const windowStart = dto.startDate ? new Date(dto.startDate) : projectStart;
    const windowEnd = dto.endDate ? new Date(dto.endDate) : projectEnd;
    const allocatedOther = sumOverlappingAllocationHours(
      employee.allocations,
      weeklyCapacity,
      windowStart,
      windowEnd,
    );
    const newHours = this.resolveWeeklyHours(dto, weeklyCapacity);
    const totalAfter = allocatedOther + newHours;
    const summary = buildAvailabilitySummary(weeklyCapacity, totalAfter);

    evaluateStaffingPolicies({
      policies,
      projectRole: dto.role,
      employeeName: employee.name,
      employeeDesignation: employee.designation,
      employeeDepartmentCode: employee.department.code,
      projectDepartmentCode,
      warnings,
    });

    const thresholdMessage = `${employee.name} would be over-allocated (${summary.allocatedHours}h/week of ${weeklyCapacity}h/week capacity).`;
    const thresholdOutcome = this.resolveThresholdOutcome(
      policies,
      summary.isOverAllocated,
      thresholdMessage,
      actorId,
    );
    warnings.push(...thresholdOutcome.warnings);

    return { employee, dto, thresholdOutcome };
  }

  private toPolicySummary(
    policies: AllocationRuntimePolicies,
  ): AllocationPolicySummaryDto {
    return mapAllocationPoliciesDto(policies);
  }

  async removeMember(
    projectId: string,
    allocationId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    const allocation = await this.prisma.allocation.findFirst({
      where: { id: allocationId, projectId },
    });

    if (!allocation) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { allocation: 'allocationNotFound' },
      });
    }

    await this.prisma.allocation.update({
      where: { id: allocationId },
      data: { status: 'Removed' },
    });
  }

  async updateMember(
    projectId: string,
    allocationId: string,
    dto: UpdateAllocationDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<UpdateProjectTeamMemberResultDto> {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    if (
      dto.role == null &&
      dto.hours === undefined &&
      dto.percent === undefined &&
      dto.backupEmployeeId === undefined &&
      dto.startDate === undefined &&
      dto.endDate === undefined
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { allocation: 'noFieldsToUpdate' },
      });
    }

    if (dto.hours !== undefined && dto.percent !== undefined) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { hours: 'hoursOrPercentNotBoth' },
      });
    }

    const allocation = await this.prisma.allocation.findFirst({
      where: {
        id: allocationId,
        projectId,
        status: { in: ['Active', 'Pending'] },
      },
      include: {
        requester: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        backupEmployee: { select: { id: true, name: true } },
        employee: {
          include: {
            ...EMPLOYEE_INCLUDE,
            allocations: { where: { status: 'Active' } },
            leaveRecords: { orderBy: { leaveDate: 'asc' } },
          },
        },
      },
    });

    if (!allocation) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { allocation: 'allocationNotFound' },
      });
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        startDate: true,
        endDate: true,
        department: { select: { code: true } },
      },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    const warnings: string[] = [];
    const policies = await this.allocationPolicyService.getPolicies();
    const effectiveRole = dto.role ?? allocation.role;
    const projectDepartmentCode = project.department.code;
    let thresholdOutcome: ThresholdOutcome | null = null;

    const nextStartDate =
      dto.startDate !== undefined
        ? new Date(dto.startDate)
        : allocation.startDate;
    const nextEndDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : allocation.endDate;

    if (nextEndDate && nextEndDate < nextStartDate) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { endDate: 'endDateMustBeAfterStartDate' },
      });
    }

    if (project.startDate && project.endDate) {
      const dateIssues = buildAllocationDateIssueMessages(
        {
          id: allocation.id,
          employeeName: allocation.employee.name,
          status: allocation.status,
          startDate: nextStartDate,
          endDate: nextEndDate,
        },
        project.startDate,
        project.endDate,
      );
      warnings.push(...dateIssues.messages);
    }

    const hoursOrPercentChanging =
      dto.hours !== undefined || dto.percent !== undefined;
    const datesChanging =
      dto.startDate !== undefined || dto.endDate !== undefined;

    if (hoursOrPercentChanging || datesChanging) {
      const validationDto: CreateAllocationDto = {
        employeeId: allocation.employeeId,
        role: effectiveRole,
        hours:
          dto.hours !== undefined
            ? dto.hours
            : allocation.hours != null
              ? Number(allocation.hours)
              : undefined,
        percent:
          dto.percent !== undefined
            ? dto.percent
            : allocation.percent != null
              ? Number(allocation.percent)
              : undefined,
        startDate: nextStartDate.toISOString().slice(0, 10),
        endDate: nextEndDate
          ? nextEndDate.toISOString().slice(0, 10)
          : undefined,
      };

      this.validateAllocationInput(validationDto);

      const weeklyCapacity = Number(allocation.employee.weeklyHours);
      const windowStart = nextStartDate;
      const windowEnd = nextEndDate ?? project.endDate ?? nextStartDate;
      const otherAllocations = allocation.employee.allocations.filter(
        (row) => row.id !== allocationId,
      );
      const allocatedOther = sumOverlappingAllocationHours(
        otherAllocations,
        weeklyCapacity,
        windowStart,
        windowEnd,
      );
      const newHours = this.resolveWeeklyHours(validationDto, weeklyCapacity);
      const summary = buildAvailabilitySummary(
        weeklyCapacity,
        allocatedOther + newHours,
      );

      if (summary.isOverAllocated) {
        const thresholdMessage = `${allocation.employee.name} would be over-allocated (${summary.allocatedHours}h/week of ${weeklyCapacity}h/week capacity).`;
        thresholdOutcome = this.resolveThresholdOutcome(
          policies,
          true,
          thresholdMessage,
          actorId,
        );
        warnings.push(...thresholdOutcome.warnings);
      } else if (hoursOrPercentChanging) {
        thresholdOutcome = this.resolveThresholdOutcome(
          policies,
          false,
          '',
          actorId,
        );
      }
    }

    if (dto.backupEmployeeId && dto.backupEmployeeId === allocation.employeeId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { backupEmployeeId: 'cannotMatchPrimaryEmployee' },
      });
    }

    if (dto.role != null || dto.hours !== undefined || dto.percent !== undefined) {
      evaluateStaffingPolicies({
        policies,
        projectRole: effectiveRole,
        employeeName: allocation.employee.name,
        employeeDesignation: allocation.employee.designation,
        employeeDepartmentCode: allocation.employee.department.code,
        projectDepartmentCode,
        warnings,
      });
    }

    const updated = await this.prisma.allocation.update({
      where: { id: allocationId },
      data: {
        ...(dto.role != null ? { role: dto.role } : {}),
        ...(dto.hours !== undefined ? { hours: dto.hours, percent: null } : {}),
        ...(dto.percent !== undefined ? { percent: dto.percent, hours: null } : {}),
        ...(dto.backupEmployeeId !== undefined
          ? { backupEmployeeId: dto.backupEmployeeId }
          : {}),
        ...(dto.startDate !== undefined ? { startDate: nextStartDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: nextEndDate } : {}),
        ...(thresholdOutcome
          ? {
              status: thresholdOutcome.status,
              approvedBy: thresholdOutcome.approvedBy,
              requestedBy: thresholdOutcome.requestedBy,
              requestedAt: thresholdOutcome.requestedAt,
              ...(thresholdOutcome.status === 'Pending'
                ? { rejectionComment: null }
                : {}),
            }
          : {}),
      },
      include: {
        requester: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        backupEmployee: { select: { id: true, name: true } },
        employee: {
          include: {
            ...EMPLOYEE_INCLUDE,
            allocations: { where: { status: 'Active' } },
            leaveRecords: { orderBy: { leaveDate: 'asc' } },
          },
        },
      },
    });

    const planningWindow =
      project.startDate && project.endDate
        ? { start: project.startDate, end: project.endDate }
        : undefined;

    if (updated.status === 'Active') {
      void this.allocationPushService.pushAllocation(updated.id);
    }

    return {
      updated: this.toProjectAllocationDto(
        updated.employee,
        updated,
        projectId,
        planningWindow,
      ),
      warnings,
      policy: this.toPolicySummary(policies),
    };
  }

  private validateAllocationInput(dto: CreateAllocationDto) {
    if (!dto.hours && !dto.percent) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { hours: 'hoursOrPercentRequired' },
      });
    }

    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { endDate: 'endDateMustBeAfterStartDate' },
      });
    }
  }

  private resolveWeeklyHours(dto: CreateAllocationDto, weeklyCapacity: number): number {
    if (dto.hours != null) {
      return dto.hours;
    }

    if (dto.percent != null) {
      return (weeklyCapacity * dto.percent) / 100;
    }

    return 0;
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

  private toTeamCandidate(
    employee: EmployeeWithAllocations & { leaveRecords?: EmployeeLeaveRecord[] },
    projectId: string | undefined,
    planningWindow: { start: Date; end: Date } | undefined,
    policies: AllocationRuntimePolicies,
    projectDepartmentCode: string,
  ): TeamCandidateDto {
    const weeklyCapacity = Number(employee.weeklyHours);
    const activeAllocations = employee.allocations.filter(
      (row) => row.status === 'Active',
    );
    const relevantAllocations = planningWindow
      ? activeAllocations.filter((row) =>
          isAllocationOverlappingWindow(
            row,
            planningWindow.start,
            planningWindow.end,
          ),
        )
      : activeAllocations.filter((row) => isAllocationActive(row));

    const sumHours = (rows: typeof relevantAllocations) =>
      planningWindow
        ? sumOverlappingAllocationHours(
            rows,
            weeklyCapacity,
            planningWindow.start,
            planningWindow.end,
          )
        : sumActiveAllocationHours(rows, weeklyCapacity);

    const allocatedHoursOtherProjects = sumHours(
      projectId
        ? relevantAllocations.filter((row) => row.projectId !== projectId)
        : relevantAllocations,
    );

    const allocatedHoursThisProject = projectId
      ? sumHours(
          relevantAllocations.filter((row) => row.projectId === projectId),
        )
      : 0;

    const allocatedHoursTotal =
      allocatedHoursOtherProjects + allocatedHoursThisProject;
    const summary = buildAvailabilitySummary(weeklyCapacity, allocatedHoursTotal);
    const leaveRanges = groupLeaveRecords(employee.leaveRecords ?? []);
    const upcomingLeave =
      planningWindow != null
        ? filterLeaveInWindow(leaveRanges, planningWindow.start, planningWindow.end)
        : filterLeaveInWindow(
            leaveRanges,
            new Date(),
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          );

    return {
      employeeId: employee.id,
      name: employee.name,
      email: employee.email,
      designation: employee.designation,
      userId: employee.userId,
      department: employee.department,
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocatedHoursOtherProjects: roundHours(allocatedHoursOtherProjects),
      allocatedHoursThisProject: roundHours(allocatedHoursThisProject),
      allocatedHoursTotal: summary.allocatedHours,
      remainingHours: summary.remainingHours,
      utilizationPercent: summary.utilizationPercent,
      isOverAllocated: summary.isOverAllocated,
      isFullyBooked: summary.isFullyBooked,
      isOnProject: projectId
        ? employee.allocations.some((row) => row.projectId === projectId)
        : false,
      upcomingLeave,
      departmentStaffingAllowed: previewDepartmentStaffingAllowed(
        policies,
        projectDepartmentCode,
        employee.department.code,
      ),
      profileImageUrl: employee.profileImageUrl,
    };
  }

  private toProjectAllocationDto(
    employee: EmployeeWithAllocations & { leaveRecords?: EmployeeLeaveRecord[] },
    allocation: Prisma.AllocationGetPayload<{
      include: {
        requester: { select: { id: true; displayName: true } };
        approver: { select: { id: true; displayName: true } };
        backupEmployee: { select: { id: true; name: true } };
      };
    }>,
    projectId: string,
    planningWindow?: { start: Date; end: Date },
  ): ProjectAllocationDto {
    const weeklyCapacity = Number(employee.weeklyHours);
    const activeAllocations = employee.allocations.filter((row) =>
      isAllocationActive(row),
    );
    const allocatedHoursTotal = sumActiveAllocationHours(
      activeAllocations,
      weeklyCapacity,
    );
    const summary = buildAvailabilitySummary(weeklyCapacity, allocatedHoursTotal);
    const leaveRanges = groupLeaveRecords(employee.leaveRecords ?? []);
    const upcomingLeave =
      planningWindow != null
        ? filterLeaveInWindow(leaveRanges, planningWindow.start, planningWindow.end)
        : filterLeaveInWindow(
            leaveRanges,
            new Date(),
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          );

    return {
      id: allocation.id,
      projectId: allocation.projectId,
      employeeId: allocation.employeeId,
      role: allocation.role,
      hours: allocation.hours != null ? Number(allocation.hours) : null,
      percent: allocation.percent != null ? Number(allocation.percent) : null,
      startDate: allocation.startDate.toISOString().slice(0, 10),
      endDate: allocation.endDate
        ? allocation.endDate.toISOString().slice(0, 10)
        : null,
      status: allocation.status,
      requestedBy: allocation.requester
        ? { id: allocation.requester.id, name: allocation.requester.displayName }
        : null,
      requestedAt: allocation.requestedAt?.toISOString() ?? null,
      approvedBy: allocation.approver
        ? { id: allocation.approver.id, name: allocation.approver.displayName }
        : null,
      kekaSyncedAt: allocation.kekaSyncedAt?.toISOString() ?? null,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        designation: employee.designation,
        userId: employee.userId,
        department: employee.department,
        profileImageUrl: employee.profileImageUrl,
      },
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocatedHoursTotal: summary.allocatedHours,
      remainingHoursTotal: summary.remainingHours,
      utilizationPercent: summary.utilizationPercent,
      isOverAllocated: summary.isOverAllocated,
      upcomingLeave,
      backupEmployeeId: allocation.backupEmployeeId,
      backupEmployeeName: allocation.backupEmployee?.name ?? null,
    };
  }

  private resolveThresholdOutcome(
    policies: AllocationRuntimePolicies,
    isOverAllocated: boolean,
    message: string,
    actorId: string,
  ): ThresholdOutcome {
    if (!isOverAllocated) {
      return {
        status: 'Active',
        approvedBy: actorId,
        requestedBy: null,
        requestedAt: null,
        warnings: [],
      };
    }

    if (policies.thresholdMode === 'block') {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { allocation: message },
      });
    }

    if (policies.thresholdMode === 'approve') {
      return {
        status: 'Pending',
        approvedBy: null,
        requestedBy: actorId,
        requestedAt: new Date(),
        warnings: [
          `${message} Submitted for staffing approval.`,
        ],
      };
    }

    return {
      status: 'Active',
      approvedBy: actorId,
      requestedBy: null,
      requestedAt: null,
      warnings: [message],
    };
  }

  private async assertProjectInScope(
    projectId: string,
    caslUser: CaslUserContext,
    action: 'read' | 'update',
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        AND: [{ id: projectId }, this.recordScopeWhere.projectWhere(caslUser, action)],
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
  }
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
