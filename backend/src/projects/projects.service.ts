import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import {
  ApiMethodology,
  ApiPriorityLevel,
  ApiProjectStatus,
  ApiCurrencyCode,
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
  constructor(private readonly prisma: PrismaService) {}

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
        currency: toPrismaCurrency(dto.currency ?? ApiCurrencyCode.USD),
        primaryPmId: dto.primaryPmId,
        secondaryPmId: dto.secondaryPmId ?? null,
        status: toPrismaStatus(dto.status ?? ApiProjectStatus.Draft),
        createdBy: actorId,
      },
      include: PROJECT_INCLUDE,
    });

    return toApiProject(project as ProjectWithRelations);
  }

  async findManyWithPagination(paginationOptions: IPaginationOptions) {
    const projects = await this.prisma.project.findMany({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      orderBy: { createdAt: 'desc' },
      include: PROJECT_INCLUDE,
    });

    return projects.map((project) =>
      toApiProject(project as ProjectWithRelations),
    );
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });

    if (!project) {
      return null;
    }

    return toApiProject(project as ProjectWithRelations);
  }

  async update(id: string, dto: UpdateProjectDto, actorId: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });

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

    return toApiProject(project as ProjectWithRelations);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.project.findUnique({ where: { id } });

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
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        roleCode: { in: PM_ROLE_CODES },
      },
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        roleCode: true,
      },
    });
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
          roleCode: { in: PM_ROLE_CODES },
        },
      }),
      dto.secondaryPmId
        ? this.prisma.user.findFirst({
            where: {
              id: dto.secondaryPmId,
              isActive: true,
              roleCode: { in: PM_ROLE_CODES },
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

  async findPhases(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
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

  async createPhase(projectId: string, dto: CreatePhaseDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
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

  async updatePhase(phaseId: string, dto: UpdatePhaseDto) {
    const existing = await this.prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { phase: 'phaseNotFound' },
      });
    }

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

  async removePhase(phaseId: string) {
    const existing = await this.prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { phase: 'phaseNotFound' },
      });
    }
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

  async findMilestones(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
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

  async createMilestone(projectId: string, dto: CreateMilestoneDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
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

  async updateMilestone(milestoneId: string, dto: UpdateMilestoneDto) {
    const existing = await this.prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { milestone: 'milestoneNotFound' },
      });
    }
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

  async removeMilestone(milestoneId: string) {
    const existing = await this.prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { milestone: 'milestoneNotFound' },
      });
    }
    await this.prisma.$transaction([
      this.prisma.invoice.updateMany({
        where: { matchedMilestoneId: milestoneId },
        data: { matchedMilestoneId: null },
      }),
      this.prisma.projectMilestone.delete({ where: { id: milestoneId } }),
    ]);
  }
}
