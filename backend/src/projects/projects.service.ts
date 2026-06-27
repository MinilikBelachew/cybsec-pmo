import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppAbility, CaslAction, CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ProjectStatus, TaskStatus, PhaseStatus } from '@prisma/client';
import {
  ApiMethodology,
  ApiPriorityLevel,
  ApiProjectStatus,
} from './enums/project-api.enum';
import {
  toApiProject,
  toPrismaBillingModel,
  toPrismaCurrency,
  toPrismaEngagementType,
  toPrismaStatus,
  type ProjectWithRelations,
} from './mappers/project.mapper';
import { RoleEnum } from '../roles/roles.enum';

const PROJECT_INCLUDE = {
  department: true,
  customer: true,
  primaryPm: { select: { id: true, displayName: true, email: true } },
  secondaryPm: { select: { id: true, displayName: true, email: true } },
} as const;

const PM_ROLE_CODES = [RoleEnum.pm, RoleEnum.pmo_lead];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async create(dto: CreateProjectDto, actorId: string) {
    await this.validateReferences(dto);

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        objective: dto.objective,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        engagementType: toPrismaEngagementType(dto.engagementType),
        methodology: dto.methodology ?? ApiMethodology.Hybrid,
        billingModel: toPrismaBillingModel(dto.billingModel),
        priority: dto.priority ?? ApiPriorityLevel.Medium,
        startDate: dto.startDate,
        endDate: dto.endDate,
        value: dto.value,
        currency: toPrismaCurrency(dto.currency ?? 'USD'),
        primaryPmId: dto.primaryPmId,
        secondaryPmId: dto.secondaryPmId ?? null,
        status: toPrismaStatus(dto.status ?? ApiProjectStatus.Draft),
        createdBy: actorId,
      },
      include: PROJECT_INCLUDE,
    });

    return toApiProject(project as ProjectWithRelations, { ability: null });
  }

  async findManyWithPagination(
    query: QueryProjectDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const filters: Record<string, unknown>[] = [scopeWhere];

    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { objective: { contains: term, mode: 'insensitive' } },
          { primaryPm: { displayName: { contains: term, mode: 'insensitive' } } },
          { secondaryPm: { displayName: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    if (query.status) {
      filters.push({ status: toPrismaStatus(query.status) });
    }

    if (query.priority) {
      filters.push({ priority: query.priority });
    }

    const where = { AND: filters };

    const [projects, statusGroups] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...PROJECT_INCLUDE,
          _count: {
            select: {
              tasks: { where: { parentTaskId: null } },
              phases: true,
              milestones: true,
            },
          },
        },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: scopeWhere,
        _count: { _all: true },
      }),
    ]);

    const projectIds = projects.map((project) => project.id);
    const [doneTaskGroups, completedPhaseGroups, doneMilestoneGroups, employeeCostGroups, budgetLineItems] =
      projectIds.length
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
          this.prisma.projectPhase.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              status: PhaseStatus.Completed,
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
          this.prisma.budgetLineItem.findMany({
            where: { budget: { projectId: { in: projectIds } } },
            select: {
              actual: true,
              budget: { select: { projectId: true } },
            },
          }),
        ])
      : [[], [], [], [], []];

    const doneTaskMap = new Map(
      doneTaskGroups.map((row) => [row.projectId, row._count._all]),
    );
    const completedPhaseMap = new Map(
      completedPhaseGroups.map((row) => [row.projectId, row._count._all]),
    );
    const doneMilestoneMap = new Map(
      doneMilestoneGroups.map((row) => [row.projectId, row._count._all]),
    );
    const employeeSpentMap = new Map(
      employeeCostGroups.map((row) => [
        row.projectId,
        Number(row._sum.totalCost ?? 0) / 1000,
      ]),
    );
    const lineItemSpentMap = new Map<string, number>();
    for (const lineItem of budgetLineItems) {
      const projectId = lineItem.budget.projectId;
      const current = lineItemSpentMap.get(projectId) ?? 0;
      lineItemSpentMap.set(projectId, current + Number(lineItem.actual) / 1000);
    }

    const resolveBudgetSpent = (projectId: string) => {
      const fromEmployee = employeeSpentMap.get(projectId) ?? 0;
      const fromLineItems = lineItemSpentMap.get(projectId) ?? 0;
      return fromEmployee > 0 ? fromEmployee : fromLineItems;
    };

    const statusCount = (status: ProjectStatus) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;

    const stats = {
      total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      active: statusCount(ProjectStatus.Active),
      atRisk: statusCount(ProjectStatus.Pending_Closure),
      delayed: statusCount(ProjectStatus.On_Hold),
      completed: statusCount(ProjectStatus.Closed),
    };

    const data = projects.map((project) => {
      const apiProject = toApiProject(project as ProjectWithRelations, { ability });
      const budgetTotal = apiProject.value ?? 0;
      const budgetSpent =
        apiProject.value !== undefined ? resolveBudgetSpent(project.id) : undefined;

      return {
        ...apiProject,
        tasksTotal: project._count.tasks,
        tasksDone: doneTaskMap.get(project.id) ?? 0,
        phasesTotal: project._count.phases,
        phasesCompleted: completedPhaseMap.get(project.id) ?? 0,
        milestonesTotal: project._count.milestones,
        milestonesDone: doneMilestoneMap.get(project.id) ?? 0,
        ...(budgetSpent !== undefined
          ? {
              budgetSpent,
              budgetRemaining: Math.max(0, budgetTotal - budgetSpent),
            }
          : {}),
      };
    });

    return { data, stats, page, limit };
  }

  async findManyForExport(
    query: QueryProjectDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const filters: Record<string, unknown>[] = [scopeWhere];

    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { objective: { contains: term, mode: 'insensitive' } },
          { primaryPm: { displayName: { contains: term, mode: 'insensitive' } } },
          { secondaryPm: { displayName: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    if (query.status) {
      filters.push({ status: toPrismaStatus(query.status) });
    }

    if (query.priority) {
      filters.push({ priority: query.priority });
    }

    const where = { AND: filters };

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...PROJECT_INCLUDE,
        _count: {
          select: {
            tasks: { where: { parentTaskId: null } },
            phases: true,
            milestones: true,
          },
        },
      },
    });

    const projectIds = projects.map((project) => project.id);
    const [doneTaskGroups, completedPhaseGroups, doneMilestoneGroups] = projectIds.length
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
          this.prisma.projectPhase.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              status: PhaseStatus.Completed,
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
      : [[], [], []];

    const doneTaskMap = new Map(
      doneTaskGroups.map((row) => [row.projectId, row._count._all]),
    );
    const completedPhaseMap = new Map(
      completedPhaseGroups.map((row) => [row.projectId, row._count._all]),
    );
    const doneMilestoneMap = new Map(
      doneMilestoneGroups.map((row) => [row.projectId, row._count._all]),
    );

    return projects.map((project) => ({
      ...toApiProject(project as ProjectWithRelations, { ability }),
      tasksTotal: project._count.tasks,
      tasksDone: doneTaskMap.get(project.id) ?? 0,
      phasesTotal: project._count.phases,
      phasesCompleted: completedPhaseMap.get(project.id) ?? 0,
      milestonesTotal: project._count.milestones,
      milestonesDone: doneMilestoneMap.get(project.id) ?? 0,
    }));
  }

  async findById(id: string, caslUser: CaslUserContext, ability: AppAbility) {
    const project = await this.prisma.project.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.projectWhere(caslUser, 'read')],
      },
      include: PROJECT_INCLUDE,
    });

    if (!project) {
      return null;
    }

    return toApiProject(project as ProjectWithRelations, { ability });
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.projectWhere(caslUser, 'update')],
      },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    const merged: CreateProjectDto = {
      name: dto.name ?? existing.name,
      objective: dto.objective ?? existing.objective,
      departmentId: dto.departmentId ?? existing.departmentId,
      customerId: dto.customerId ?? existing.customerId,
      engagementType: dto.engagementType as CreateProjectDto['engagementType'],
      billingModel: dto.billingModel as CreateProjectDto['billingModel'],
      methodology: dto.methodology,
      priority: dto.priority,
      startDate: dto.startDate ?? existing.startDate,
      endDate: dto.endDate ?? existing.endDate,
      value: dto.value ?? Number(existing.value),
      currency: dto.currency,
      primaryPmId: dto.primaryPmId ?? existing.primaryPmId,
      secondaryPmId:
        dto.secondaryPmId !== undefined
          ? dto.secondaryPmId
          : existing.secondaryPmId,
      status: dto.status,
    };

    if (
      dto.departmentId ||
      dto.customerId ||
      dto.primaryPmId ||
      dto.secondaryPmId !== undefined ||
      dto.startDate ||
      dto.endDate
    ) {
      await this.validateReferences(merged);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.engagementType !== undefined && {
          engagementType: toPrismaEngagementType(dto.engagementType),
        }),
        ...(dto.methodology !== undefined && { methodology: dto.methodology }),
        ...(dto.billingModel !== undefined && {
          billingModel: toPrismaBillingModel(dto.billingModel),
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.currency !== undefined && {
          currency: toPrismaCurrency(dto.currency),
        }),
        ...(dto.primaryPmId !== undefined && { primaryPmId: dto.primaryPmId }),
        ...(dto.secondaryPmId !== undefined && {
          secondaryPmId: dto.secondaryPmId,
        }),
        ...(dto.status !== undefined && { status: toPrismaStatus(dto.status) }),
      },
      include: PROJECT_INCLUDE,
    });

    return toApiProject(project as ProjectWithRelations, { ability });
  }

  async remove(id: string, caslUser: CaslUserContext, ability: AppAbility): Promise<void> {
    const existing = await this.prisma.project.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.projectWhere(caslUser, 'approve')],
      },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    await this.prisma.project.delete({ where: { id } });
  }

  async findDepartments() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async findCustomers() {
    return this.prisma.customer.findMany({
      where: { status: 'Active' },
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        industry: true,
        status: true,
      },
    });
  }

  async findProjectManagers() {
    const managers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          code: { in: PM_ROLE_CODES },
        },
      },
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: { select: { id: true, code: true } },
      },
    });

    return managers.map((manager) => ({
      id: manager.id,
      displayName: manager.displayName,
      email: manager.email,
      roleId: manager.role.id,
      roleCode: manager.role.code,
    }));
  }

  private async validateReferences(dto: CreateProjectDto): Promise<void> {
    const [department, customer, primaryPm, secondaryPm] = await Promise.all([
      this.prisma.department.findFirst({
        where: { id: dto.departmentId, isActive: true },
      }),
      this.prisma.customer.findFirst({
        where: { id: dto.customerId, status: 'Active' },
      }),
      this.prisma.user.findFirst({
        where: {
          id: dto.primaryPmId,
          isActive: true,
          role: { code: { in: PM_ROLE_CODES } },
        },
      }),
      dto.secondaryPmId
        ? this.prisma.user.findFirst({
            where: {
              id: dto.secondaryPmId,
              isActive: true,
              role: { code: { in: PM_ROLE_CODES } },
            },
          })
        : Promise.resolve(null),
    ]);

    const errors: Record<string, string> = {};

    if (!department) errors.departmentId = 'departmentNotFound';
    if (!customer) errors.customerId = 'customerNotFound';
    if (!primaryPm) errors.primaryPmId = 'primaryPmNotFoundOrInvalidRole';
    if (dto.secondaryPmId && !secondaryPm) {
      errors.secondaryPmId = 'secondaryPmNotFoundOrInvalidRole';
    }
    if (dto.secondaryPmId && dto.secondaryPmId === dto.primaryPmId) {
      errors.secondaryPmId = 'secondaryPmMustDifferFromPrimary';
    }
    if (dto.endDate <= dto.startDate) {
      errors.endDate = 'End date must be after the start date';
    }

    if (Object.keys(errors).length > 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors,
      });
    }
  }

  private async assertProjectInScope(
    projectId: string,
    caslUser: CaslUserContext,
    action: CaslAction,
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

  async findPhases(projectId: string, caslUser: CaslUserContext) {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const phases = await this.prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
      include: { milestones: true },
    });
    return phases.map((phase) => ({
      ...phase,
      milestones: phase.milestones.map((m) => ({
        ...m,
        weight: m.weight ? Number(m.weight) : null,
      })),
    }));
  }

  async createPhase(projectId: string, dto: CreatePhaseDto, caslUser: CaslUserContext) {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { endDate: 'endDateMustBeAfterStartDate' },
      });
    }
    return this.prisma.projectPhase.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        orderIndex: dto.orderIndex ?? 0,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: dto.status,
      },
    });
  }

  async updatePhase(phaseId: string, dto: UpdatePhaseDto, caslUser: CaslUserContext) {
    const existing = await this.prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { phase: 'phaseNotFound' },
      });
    }

    await this.assertProjectInScope(existing.projectId, caslUser, 'update');

    const startDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : existing.endDate;
    if (startDate && endDate && startDate > endDate) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { endDate: 'endDateMustBeAfterStartDate' },
      });
    }

    return this.prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async removePhase(phaseId: string, caslUser: CaslUserContext) {
    const existing = await this.prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { phase: 'phaseNotFound' },
      });
    }

    await this.assertProjectInScope(existing.projectId, caslUser, 'approve');

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { phaseId },
        data: { phaseId: null },
      }),
      this.prisma.projectMilestone.updateMany({
        where: { phaseId },
        data: { phaseId: null },
      }),
      this.prisma.projectPhase.delete({ where: { id: phaseId } }),
    ]);
  }

  async findMilestones(projectId: string, caslUser: CaslUserContext) {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const milestones = await this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { targetDate: 'asc' },
      include: { phase: true },
    });
    return milestones.map((m) => ({
      ...m,
      weight: m.weight ? Number(m.weight) : null,
    }));
  }

  async createMilestone(
    projectId: string,
    dto: CreateMilestoneDto,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    if (dto.phaseId) {
      const phase = await this.prisma.projectPhase.findFirst({
        where: { id: dto.phaseId, projectId },
      });
      if (!phase) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { phase: 'phaseNotFoundOrNotBelongToProject' },
        });
      }
    }
    const milestone = await this.prisma.projectMilestone.create({
      data: {
        projectId,
        title: dto.title,
        targetDate: dto.targetDate,
        weight: dto.weight,
        status: dto.status ?? 'Pending',
        phaseId: dto.phaseId ?? null,
      },
    });
    return {
      ...milestone,
      weight: milestone.weight ? Number(milestone.weight) : null,
    };
  }

  async updateMilestone(
    milestoneId: string,
    dto: UpdateMilestoneDto,
    caslUser: CaslUserContext,
  ) {
    const existing = await this.prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { milestone: 'milestoneNotFound' },
      });
    }

    await this.assertProjectInScope(existing.projectId, caslUser, 'update');

    if (dto.phaseId) {
      const phase = await this.prisma.projectPhase.findFirst({
        where: { id: dto.phaseId, projectId: existing.projectId },
      });
      if (!phase) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { phase: 'phaseNotFoundOrNotBelongToProject' },
        });
      }
    }
    const milestone = await this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.targetDate !== undefined && { targetDate: dto.targetDate }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.phaseId !== undefined && { phaseId: dto.phaseId }),
      },
    });
    return {
      ...milestone,
      weight: milestone.weight ? Number(milestone.weight) : null,
    };
  }

  async removeMilestone(milestoneId: string, caslUser: CaslUserContext) {
    const existing = await this.prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { milestone: 'milestoneNotFound' },
      });
    }

    await this.assertProjectInScope(existing.projectId, caslUser, 'approve');

    await this.prisma.$transaction([
      this.prisma.invoice.updateMany({
        where: { matchedMilestoneId: milestoneId },
        data: { matchedMilestoneId: null },
      }),
      this.prisma.projectMilestone.delete({ where: { id: milestoneId } }),
    ]);
  }
}
