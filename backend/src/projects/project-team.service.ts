import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { QueryTeamCandidatesDto } from './dto/query-team-candidates.dto';
import {
  CreateProjectTeamResultDto,
  ProjectAllocationDto,
  ProjectTaskAssigneeDto,
  TeamCandidateDto,
} from './dto/project-allocation.dto';
import {
  buildAvailabilitySummary,
  isAllocationActive,
  sumActiveAllocationHours,
} from './utils/allocation-availability.util';

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

@Injectable()
export class ProjectTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async findCandidates(
    query: QueryTeamCandidatesDto,
    caslUser: CaslUserContext,
  ): Promise<TeamCandidateDto[]> {
    if (query.projectId) {
      await this.assertProjectInScope(query.projectId, caslUser, 'read');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      },
      include: {
        ...EMPLOYEE_INCLUDE,
        allocations: {
          where: { status: 'Active' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return employees.map((employee) =>
      this.toTeamCandidate(employee, query.projectId),
    );
  }

  async findProjectTeam(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectAllocationDto[]> {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const allocations = await this.prisma.allocation.findMany({
      where: { projectId, status: 'Active' },
      include: {
        employee: {
          include: {
            ...EMPLOYEE_INCLUDE,
            allocations: { where: { status: 'Active' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return allocations.map((allocation) =>
      this.toProjectAllocationDto(allocation.employee, allocation, projectId),
    );
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

  async addMembers(
    projectId: string,
    allocations: CreateAllocationDto[],
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<CreateProjectTeamResultDto> {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    const warnings: string[] = [];
    const created: ProjectAllocationDto[] = [];

    for (const dto of allocations) {
      this.validateAllocationInput(dto);

      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, isActive: true },
        include: {
          ...EMPLOYEE_INCLUDE,
          allocations: { where: { status: 'Active', projectId: { not: projectId } } },
        },
      });

      if (!employee) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { employeeId: 'employeeNotFoundOrInactive' },
        });
      }

      const existing = await this.prisma.allocation.findFirst({
        where: {
          projectId,
          employeeId: dto.employeeId,
          status: 'Active',
        },
      });

      if (existing) {
        throw new ConflictException({
          status: HttpStatus.CONFLICT,
          errors: {
            employeeId: `${employee.name} is already on this project team`,
          },
        });
      }

      const weeklyCapacity = Number(employee.weeklyHours);
      const allocatedOther = sumActiveAllocationHours(
        employee.allocations,
        weeklyCapacity,
      );
      const newHours = this.resolveWeeklyHours(dto, weeklyCapacity);
      const totalAfter = allocatedOther + newHours;
      const summary = buildAvailabilitySummary(weeklyCapacity, totalAfter);

      if (summary.isOverAllocated) {
        warnings.push(
          `${employee.name} would be over-allocated (${summary.allocatedHours}h/wk of ${weeklyCapacity}h/wk capacity).`,
        );
      }

      const allocation = await this.prisma.allocation.create({
        data: {
          projectId,
          employeeId: dto.employeeId,
          role: dto.role,
          hours: dto.hours ?? null,
          percent: dto.percent ?? null,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          status: 'Active',
          approvedBy: actorId,
        },
        include: {
          employee: {
            include: {
              ...EMPLOYEE_INCLUDE,
              allocations: { where: { status: 'Active' } },
            },
          },
        },
      });

      created.push(
        this.toProjectAllocationDto(
          allocation.employee,
          allocation,
          projectId,
        ),
      );
    }

    return { created, warnings };
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

  private toTeamCandidate(
    employee: EmployeeWithAllocations,
    projectId?: string,
  ): TeamCandidateDto {
    const weeklyCapacity = Number(employee.weeklyHours);
    const activeAllocations = employee.allocations.filter((row) =>
      isAllocationActive(row),
    );

    const allocatedHoursOtherProjects = sumActiveAllocationHours(
      projectId
        ? activeAllocations.filter((row) => row.projectId !== projectId)
        : activeAllocations,
      weeklyCapacity,
    );

    const allocatedHoursThisProject = projectId
      ? sumActiveAllocationHours(
          activeAllocations.filter((row) => row.projectId === projectId),
          weeklyCapacity,
        )
      : 0;

    const allocatedHoursTotal =
      allocatedHoursOtherProjects + allocatedHoursThisProject;
    const summary = buildAvailabilitySummary(weeklyCapacity, allocatedHoursTotal);

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
        ? activeAllocations.some((row) => row.projectId === projectId)
        : false,
    };
  }

  private toProjectAllocationDto(
    employee: EmployeeWithAllocations,
    allocation: Prisma.AllocationGetPayload<object>,
    projectId: string,
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
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        designation: employee.designation,
        userId: employee.userId,
        department: employee.department,
      },
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocatedHoursTotal: summary.allocatedHours,
      remainingHoursTotal: summary.remainingHours,
      utilizationPercent: summary.utilizationPercent,
      isOverAllocated: summary.isOverAllocated,
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
