import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppAbility, CaslAction, CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { PermissionsCacheService } from '../casl/permissions-cache.service';
import { hasModulePermission } from '../casl/module-permission.util';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto, type ProjectSortField } from './dto/query-project.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ProjectStatus, TaskStatus, PhaseStatus, PartyType, Prisma } from '@prisma/client';
import { ClientSyncService } from '../integrations/keka/sync/client-sync.service';
import { ProjectLinkService } from '../integrations/keka/sync/project-link.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../integrations/keka/keka.constants';
import {
  ApiPriorityLevel,
  ApiProjectMethodology,
  ApiProjectStatus,
} from './enums/project-api.enum';
import {
  toApiProject,
  toPrismaBillingModel,
  toPrismaCurrency,
  toPrismaEngagementType,
  toPrismaMethodology,
  toPrismaStatus,
  STATUS_FROM_PRISMA,
  type ProjectWithRelations,
} from './mappers/project.mapper';
import {
  assertValidProjectStatusOnCreate,
  assertValidProjectStatusTransition,
} from './project-status.transitions';
import { RoleEnum } from '../roles/roles.enum';
import { deleteProjectWithDependents } from './project-delete.cascade';

const PROJECT_INCLUDE = {
  department: true,
  customer: true,
  primaryPm: { select: { id: true, displayName: true, email: true } },
  secondaryPm: { select: { id: true, displayName: true, email: true } },
} as const;

const PM_ROLE_CODES = [RoleEnum.pm, RoleEnum.pmo_lead];

function buildProjectOrderBy(
  sortBy?: ProjectSortField,
  sortOrder: 'asc' | 'desc' = 'desc',
): Prisma.ProjectOrderByWithRelationInput {
  switch (sortBy) {
    case 'name':
      return { name: sortOrder };
    case 'priority':
      return { priority: sortOrder };
    case 'status':
      return { status: sortOrder };
    case 'startDate':
      return { startDate: sortOrder };
    case 'endDate':
      return { endDate: sortOrder };
    case 'value':
      return { value: sortOrder };
    case 'primaryPm':
      return { primaryPm: { displayName: sortOrder } };
    case 'createdAt':
    default:
      return { createdAt: sortOrder };
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly clientSyncService: ClientSyncService,
    private readonly projectLinkService: ProjectLinkService,
  ) {}

  private permissionsFor(user: CaslUserContext) {
    return this.permissionsCache.getByRoleId(user.roleId);
  }

  private canViewFinancials(user: CaslUserContext) {
    return hasModulePermission(
      this.permissionsFor(user),
      'financials',
      'view',
    );
  }

  async create(
    dto: CreateProjectDto & { milestones?: CreateMilestoneDto[] },
    actorId: string,
  ) {
    const createStatus = dto.status ?? ApiProjectStatus.Draft;
    assertValidProjectStatusOnCreate(createStatus);
    this.assertPrimaryPmPresent(dto.primaryPmId);
    this.assertOwnersRequiredForStatus(
      dto.status ?? ApiProjectStatus.Draft,
      dto.primaryPmId,
    );
    await this.validateReferences(dto);

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, status: 'Active' },
      select: { id: true, kekaClientId: true },
    });

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name,
          objective: dto.objective,
          departmentId: dto.departmentId,
          customerId: dto.customerId,
          engagementType: toPrismaEngagementType(dto.engagementType),
          billingModel: toPrismaBillingModel(dto.billingModel),
          kekaClientId: customer?.kekaClientId ?? undefined,
          methodology: toPrismaMethodology(
            dto.methodology ?? ApiProjectMethodology.Agile,
          ),
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

      if (dto.milestones?.length) {
        for (const milestone of dto.milestones) {
          await tx.projectMilestone.create({
            data: {
              projectId: created.id,
              title: milestone.title,
              targetDate: milestone.targetDate,
              weight: milestone.weight ?? null,
              status: milestone.status ?? 'Pending',
              phaseId: milestone.phaseId ?? null,
            },
          });
        }
      }

      return created;
    });

    let kekaProjectId: string | null = null;
    let kekaSyncError: string | null = null;

    if (customer?.kekaClientId) {
      try {
        kekaProjectId = await this.projectLinkService.ensureProjectLinked(
          project.id,
        );
      } catch (error) {
        kekaSyncError =
          error instanceof Error
            ? error.message
            : 'Keka project create/link failed';
        await this.prisma.kekaSyncLog.create({
          data: {
            entityType: KEKA_ENTITY_TYPE.PROJECT,
            entityId: project.id,
            direction: KEKA_SYNC_DIRECTION.OUTBOUND,
            status: KEKA_SYNC_STATUS.FAILED,
            errorMsg: kekaSyncError,
            payload: {
              customerId: customer.id,
              kekaClientId: customer.kekaClientId,
            },
          },
        });
      }
    } else {
      kekaSyncError =
        'Customer is not linked to a Keka client; project was created locally only';
    }

    const apiProject = toApiProject(project as ProjectWithRelations, {
      ability: null,
    });
    return {
      ...apiProject,
      kekaProjectId:
        kekaProjectId ??
        (project as { kekaProjectId?: string | null }).kekaProjectId ??
        null,
      kekaClientId: customer?.kekaClientId ?? null,
      kekaSyncError,
    };
  }

  /** Internal rollback helper when bundle team assignment fails after project insert. */
  async deleteProjectByIdForRollback(projectId: string): Promise<void> {
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async findManyWithPagination(
    query: QueryProjectDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const permissions = this.permissionsFor(caslUser);
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
    const orderBy = buildProjectOrderBy(query.sortBy, query.sortOrder ?? 'desc');

    const [projects, total, portfolioStats] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
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
      this.prisma.project.count({ where }),
      this.getPortfolioStats(caslUser),
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

    const stats = {
      total: portfolioStats.total,
      active: portfolioStats.active,
      atRisk: portfolioStats.atRisk,
      delayed: portfolioStats.delayed,
      completed: portfolioStats.completed,
      pendingClosure: portfolioStats.pendingClosure,
      cancelled: portfolioStats.cancelled,
      ...( 'totalValue' in portfolioStats
        ? { totalValue: portfolioStats.totalValue }
        : {}),
    };

    const data = projects.map((project) => {
      const apiProject = toApiProject(project as ProjectWithRelations, {
        ability,
        permissions,
      });
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

    return { data, stats, page, limit, total };
  }

  async getPortfolioStats(caslUser: CaslUserContext) {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const showFinancials = this.canViewFinancials(caslUser);

    const [statusGroups, valueAgg] = await Promise.all([
      this.prisma.project.groupBy({
        by: ['status'],
        where: scopeWhere,
        _count: { _all: true },
      }),
      showFinancials
        ? this.prisma.project.aggregate({
            where: scopeWhere,
            _sum: { value: true },
          })
        : Promise.resolve(null),
    ]);

    const byStatus = new Map(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    const base = {
      total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      active: byStatus.get(ProjectStatus.Active) ?? 0,
      atRisk: byStatus.get(ProjectStatus.At_Risk) ?? 0,
      delayed: byStatus.get(ProjectStatus.On_Hold) ?? 0,
      completed: byStatus.get(ProjectStatus.Closed) ?? 0,
      pendingClosure: byStatus.get(ProjectStatus.Pending_Closure) ?? 0,
      cancelled: byStatus.get(ProjectStatus.Cancelled) ?? 0,
    };

    if (!showFinancials) {
      return base;
    }

    return {
      ...base,
      totalValue: Number(valueAgg?._sum.value ?? 0),
    };
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
      ...toApiProject(project as ProjectWithRelations, {
        ability,
        permissions: this.permissionsFor(caslUser),
      }),
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

    return toApiProject(project as ProjectWithRelations, {
      ability,
      permissions: this.permissionsFor(caslUser),
    });
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const permissions = this.permissionsFor(caslUser);
    const existing = await this.prisma.project.findFirst({
      where: {
        AND: [{ id }, this.recordScopeWhere.projectWhere(caslUser, 'read')],
      },
    });

    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    if (dto.primaryPmId === null) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { primaryPmId: 'primaryPmCannotBeRemoved' },
      });
    }

    const merged: CreateProjectDto = {
      name: dto.name ?? existing.name,
      objective: dto.objective ?? existing.objective,
      departmentId: dto.departmentId ?? existing.departmentId,
      customerId: dto.customerId ?? existing.customerId,
      engagementType: dto.engagementType as CreateProjectDto['engagementType'],
      billingModel: dto.billingModel as CreateProjectDto['billingModel'],
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
      status: dto.status ?? (STATUS_FROM_PRISMA[existing.status] as ApiProjectStatus),
    };

    this.assertPrimaryPmPresent(merged.primaryPmId);
    this.assertOwnersRequiredForStatus(
      merged.status ?? ApiProjectStatus.Draft,
      merged.primaryPmId,
    );

    if (dto.status !== undefined) {
      const fromStatus = STATUS_FROM_PRISMA[existing.status];
      assertValidProjectStatusTransition(
        fromStatus,
        dto.status,
        caslUser.roleCode,
      );
    }

    if (
      dto.departmentId ||
      dto.customerId ||
      dto.primaryPmId ||
      dto.secondaryPmId !== undefined ||
      dto.startDate ||
      dto.endDate ||
      dto.status !== undefined
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
        ...(dto.billingModel !== undefined && {
          billingModel: toPrismaBillingModel(dto.billingModel),
        }),
        ...(dto.methodology !== undefined && {
          methodology: toPrismaMethodology(dto.methodology),
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

    return toApiProject(project as ProjectWithRelations, { ability, permissions });
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

    await this.prisma.$transaction((tx) => deleteProjectWithDependents(tx, id));
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
        kekaClientId: true,
        kekaClientCode: true,
      },
    });
  }

  /**
   * Currencies from Keka (GET /hris/currencies) for PSA client billingCurrencyId.
   */
  async findKekaCurrencies() {
    return this.clientSyncService.listCurrencies();
  }

  /**
   * Create customer in PMO and also in Keka (POST /psa/clients).
   * Keka requires name + code + billingInfo.billingCurrencyId.
   * Local create still succeeds if Keka push fails; failure is logged for admin retry.
   */
  async createCustomer(dto: CreateCustomerDto) {
    const name = dto.name.trim();
    const code =
      dto.code?.trim() || this.clientSyncService.buildClientCode(name);
    const email = dto.email?.trim() || null;
    const phone = dto.phone?.trim() || null;
    const website = dto.website?.trim() || null;
    const notes = dto.description?.trim() || null;
    const billingCurrencyId = dto.billingCurrencyId.trim();
    const billingAddress = dto.billingAddress
      ? {
          addressLine1: dto.billingAddress.addressLine1?.trim() || null,
          addressLine2: dto.billingAddress.addressLine2?.trim() || null,
          countryCode: dto.billingAddress.countryCode?.trim() || null,
          city: dto.billingAddress.city?.trim() || null,
          state: dto.billingAddress.state?.trim() || null,
          zip: dto.billingAddress.zip?.trim() || null,
        }
      : null;

    if (email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { primaryEmail: email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: 'customerEmailAlreadyExists' },
        });
      }
    }

    let kekaClientId: string | null = null;
    let kekaError: string | null = null;
    try {
      kekaClientId = await this.clientSyncService.createClientInKeka({
        name,
        code,
        description: notes,
        email,
        phone,
        website,
        billingInfo: {
          billingCurrencyId,
          ...(billingAddress
            ? {
                billingAddress: {
                  addressLine1: billingAddress.addressLine1,
                  addressLine2: billingAddress.addressLine2,
                  countryCode: billingAddress.countryCode,
                  city: billingAddress.city,
                  state: billingAddress.state,
                  zip: billingAddress.zip,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      kekaError =
        error instanceof Error ? error.message : 'Keka client create failed';
    }

    const addressParts = [
      billingAddress?.addressLine1,
      billingAddress?.addressLine2,
      billingAddress?.city,
      billingAddress?.state,
      billingAddress?.zip,
      billingAddress?.countryCode,
    ]
      .map((part) => part?.trim())
      .filter(Boolean);

    const customer = await this.prisma.customer.create({
      data: {
        type: PartyType.Company,
        displayName: name,
        companyName: name,
        notes,
        primaryEmail: email,
        primaryPhone: phone,
        country: billingAddress?.countryCode || null,
        address: addressParts.length ? addressParts.join(', ') : null,
        kekaClientCode: code,
        kekaClientId,
        kekaSyncedAt: kekaClientId ? new Date() : null,
        status: 'Active',
      },
      select: {
        id: true,
        displayName: true,
        industry: true,
        status: true,
        kekaClientId: true,
        kekaClientCode: true,
      },
    });

    if (kekaClientId) {
      await this.prisma.kekaSyncLog.create({
        data: {
          entityType: KEKA_ENTITY_TYPE.CLIENT,
          entityId: customer.id,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          status: KEKA_SYNC_STATUS.SUCCESS,
          payload: { name, code, billingCurrencyId, kekaClientId },
        },
      });
    } else if (kekaError) {
      await this.prisma.kekaSyncLog.create({
        data: {
          entityType: KEKA_ENTITY_TYPE.CLIENT,
          entityId: customer.id,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          status: KEKA_SYNC_STATUS.FAILED,
          errorMsg: kekaError,
          payload: { name, code, billingCurrencyId },
        },
      });
    }

    return {
      ...customer,
      kekaSyncError: kekaError,
    };
  }

  async findProjectManagers() {
    const managers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          code: { in: PM_ROLE_CODES },
        },
        // Hide users linked to a Keka-inactive employee; keep users with no employee row.
        OR: [{ employees: null }, { employees: { isActive: true } }],
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

  private assertPrimaryPmPresent(primaryPmId?: string | null): void {
    if (!primaryPmId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { primaryPmId: 'primaryPmRequired' },
      });
    }
  }

  private assertOwnersRequiredForStatus(
    status: ApiProjectStatus,
    primaryPmId?: string | null,
  ): void {
    if (status === ApiProjectStatus.Draft) {
      return;
    }

    this.assertPrimaryPmPresent(primaryPmId);
  }

  private async validateReferences(dto: CreateProjectDto): Promise<void> {
    const errors: Record<string, string> = {};

    if (!dto.primaryPmId) {
      errors.primaryPmId = 'primaryPmRequired';
    }

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
          OR: [{ employees: null }, { employees: { isActive: true } }],
        },
      }),
      dto.secondaryPmId
        ? this.prisma.user.findFirst({
            where: {
              id: dto.secondaryPmId,
              isActive: true,
              role: { code: { in: PM_ROLE_CODES } },
              OR: [{ employees: null }, { employees: { isActive: true } }],
            },
          })
        : Promise.resolve(null),
    ]);

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
    await this.assertProjectInScope(projectId, caslUser, 'create');

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

    const assignedTaskCount = await this.prisma.task.count({
      where: { phaseId },
    });
    if (assignedTaskCount > 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phase: 'phaseHasAssignedTasks' },
        message: `Cannot delete this phase while ${assignedTaskCount} task(s) are assigned to it. Unassign or move those tasks first.`,
      });
    }

    await this.prisma.$transaction([
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
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }

    if (dto.targetDate) {
      const target = new Date(dto.targetDate);
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      target.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (target < start || target > end) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { targetDate: 'milestoneTargetDateOutsideProject' },
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
