import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, PriorityLevel, TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { ProjectsService } from '../projects/projects.service';
import { SaveProjectTemplateDto } from './dto/save-project-template.dto';
import { InstantiateProjectTemplateDto } from './dto/instantiate-project-template.dto';
import { ProjectTemplateDto } from './dto/project-template.dto';

const TEMPLATE_INCLUDE = {
  templatePhases: { orderBy: { orderIndex: 'asc' as const } },
  templateMilestones: { orderBy: { relativeTargetDays: 'asc' as const } },
  templateTasks: { orderBy: { relativeStartDays: 'asc' as const } },
  _count: {
    select: {
      templatePhases: true,
      templateMilestones: true,
      templateTasks: true,
    },
  },
} satisfies Prisma.ProjectTemplateInclude;

/** Large projects can insert thousands of template rows; default 5s is too low. */
const LARGE_TX = {
  maxWait: 60_000,
  timeout: 300_000,
} as const;

function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function asDateOnly(value: Date | string): Date {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class ProjectTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(caslUser: CaslUserContext): Promise<ProjectTemplateDto[]> {
    void caslUser;
    const rows = await this.prisma.projectTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: TEMPLATE_INCLUDE,
    });
    return rows.map((row) => this.toDto(row));
  }

  async getOne(id: string): Promise<ProjectTemplateDto> {
    const row = await this.prisma.projectTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Project template not found');
    }
    return this.toDto(row, true);
  }

  async saveFromProject(
    dto: SaveProjectTemplateDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectTemplateDto> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: dto.projectId }, scopeWhere] },
      include: {
        phases: { orderBy: { orderIndex: 'asc' } },
        milestones: true,
        tasks: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }

    const projectStart = asDateOnly(project.startDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.projectTemplate.create({
        data: {
          name: dto.name.trim(),
          category: (dto.category?.trim() || 'General').slice(0, 100),
          description: dto.description?.trim() || null,
          engagementType: project.engagementType,
          createdBy: actorId,
        },
      });

      const phaseIdMap = new Map<string, string>();
      if (project.phases.length > 0) {
        const phaseRows: Prisma.TemplatePhaseCreateManyInput[] = project.phases.map(
          (phase) => {
            const newId = randomUUID();
            phaseIdMap.set(phase.id, newId);
            const start = asDateOnly(phase.startDate);
            const end = asDateOnly(phase.endDate);
            return {
              id: newId,
              templateId: template.id,
              name: phase.name,
              description: phase.description,
              orderIndex: phase.orderIndex,
              relativeStartDays: Math.max(0, calendarDaysBetween(projectStart, start)),
              durationDays: Math.max(1, calendarDaysBetween(start, end) || 1),
            };
          },
        );
        await tx.templatePhase.createMany({ data: phaseRows });
      }

      if (project.milestones.length > 0) {
        const milestoneRows: Prisma.TemplateMilestoneCreateManyInput[] =
          project.milestones.map((milestone) => {
            const target = asDateOnly(milestone.targetDate);
            return {
              id: randomUUID(),
              templateId: template.id,
              templatePhaseId: milestone.phaseId
                ? (phaseIdMap.get(milestone.phaseId) ?? null)
                : null,
              title: milestone.title,
              relativeTargetDays: Math.max(
                0,
                calendarDaysBetween(projectStart, target),
              ),
              weight: milestone.weight,
            };
          });
        await tx.templateMilestone.createMany({ data: milestoneRows });
      }

      const taskIdMap = new Map<string, string>();
      let pending = [...project.tasks];
      while (pending.length > 0) {
        const ready = pending.filter(
          (task) => !task.parentTaskId || taskIdMap.has(task.parentTaskId),
        );
        const wave = ready.length > 0 ? ready : pending;
        const waveIds = new Set(wave.map((task) => task.id));
        pending = pending.filter((task) => !waveIds.has(task.id));

        const taskRows: Prisma.TemplateTaskCreateManyInput[] = wave.map((task) => {
          const newId = randomUUID();
          taskIdMap.set(task.id, newId);
          const start = task.startDate ? asDateOnly(task.startDate) : projectStart;
          const end = task.endDate ? asDateOnly(task.endDate) : start;
          return {
            id: newId,
            templateId: template.id,
            templatePhaseId: task.phaseId
              ? (phaseIdMap.get(task.phaseId) ?? null)
              : null,
            parentId: task.parentTaskId
              ? (taskIdMap.get(task.parentTaskId) ?? null)
              : null,
            title: task.title,
            description: task.description,
            relativeStartDays: Math.max(0, calendarDaysBetween(projectStart, start)),
            durationDays: Math.max(1, calendarDaysBetween(start, end) || 1),
            priority: task.priority,
            effortHours: task.effortHours,
          };
        });
        await tx.templateTask.createMany({ data: taskRows });
      }

      return tx.projectTemplate.findUniqueOrThrow({
        where: { id: template.id },
        include: TEMPLATE_INCLUDE,
      });
    }, LARGE_TX);

    return this.toDto(created, true);
  }

  async instantiate(
    templateId: string,
    dto: InstantiateProjectTemplateDto,
    actorId: string,
  ) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException('Project template not found');
    }

    const projectStart = asDateOnly(dto.startDate);
    const projectEnd = asDateOnly(dto.endDate);
    if (projectEnd <= projectStart) {
      throw new BadRequestException('End date must be after the start date');
    }

    const createDto = {
      ...dto,
      name: (dto.projectName ?? dto.name).trim(),
      // Template carries structure; avoid double-creating milestones from the form.
      milestones: undefined,
    };

    const created = await this.projectsService.create(createDto, actorId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: created.id },
          data: { templateId: template.id },
        });

        const phaseIdMap = new Map<string, string>();
        if (template.templatePhases.length > 0) {
          const phaseRows: Prisma.ProjectPhaseCreateManyInput[] =
            template.templatePhases.map((phase) => {
              const newId = randomUUID();
              phaseIdMap.set(phase.id, newId);
              const start = addCalendarDays(projectStart, phase.relativeStartDays);
              let end = addCalendarDays(start, Math.max(1, phase.durationDays));
              if (end > projectEnd) end = projectEnd;
              if (end < start) end = start;
              return {
                id: newId,
                projectId: created.id,
                name: phase.name,
                description: phase.description,
                orderIndex: phase.orderIndex,
                startDate: start,
                endDate: end,
              };
            });
          await tx.projectPhase.createMany({ data: phaseRows });
        }

        if (template.templateMilestones.length > 0) {
          const milestoneRows: Prisma.ProjectMilestoneCreateManyInput[] =
            template.templateMilestones.map((milestone) => {
              let target = addCalendarDays(
                projectStart,
                milestone.relativeTargetDays,
              );
              if (target > projectEnd) target = projectEnd;
              if (target < projectStart) target = projectStart;
              return {
                id: randomUUID(),
                projectId: created.id,
                phaseId: milestone.templatePhaseId
                  ? (phaseIdMap.get(milestone.templatePhaseId) ?? null)
                  : null,
                title: milestone.title,
                targetDate: target,
                weight: milestone.weight,
                status: 'Pending',
              };
            });
          await tx.projectMilestone.createMany({ data: milestoneRows });
        }

        const taskIdMap = new Map<string, string>();
        let pending = [...template.templateTasks];
        while (pending.length > 0) {
          const ready = pending.filter(
            (task) => !task.parentId || taskIdMap.has(task.parentId),
          );
          const wave = ready.length > 0 ? ready : pending;
          const waveIds = new Set(wave.map((task) => task.id));
          pending = pending.filter((task) => !waveIds.has(task.id));

          const taskRows: Prisma.TaskCreateManyInput[] = wave.map((task) => {
            const newId = randomUUID();
            taskIdMap.set(task.id, newId);
            let start = addCalendarDays(projectStart, task.relativeStartDays);
            let end = addCalendarDays(start, Math.max(1, task.durationDays));
            if (start > projectEnd) start = projectEnd;
            if (end > projectEnd) end = projectEnd;
            if (end < start) end = start;
            return {
              id: newId,
              projectId: created.id,
              phaseId: task.templatePhaseId
                ? (phaseIdMap.get(task.templatePhaseId) ?? null)
                : null,
              parentTaskId: task.parentId
                ? (taskIdMap.get(task.parentId) ?? null)
                : null,
              title: task.title,
              description: task.description,
              priority: task.priority as PriorityLevel,
              startDate: start,
              endDate: end,
              effortHours: task.effortHours,
              status: TaskStatus.To_Do,
            };
          });
          await tx.task.createMany({ data: taskRows });
        }
      }, LARGE_TX);
    } catch (err) {
      await this.projectsService.deleteProjectByIdForRollback(created.id);
      throw err;
    }

    return created;
  }

  private toDto(
    row: Prisma.ProjectTemplateGetPayload<{ include: typeof TEMPLATE_INCLUDE }>,
    withDetails = false,
  ): ProjectTemplateDto {
    const dto: ProjectTemplateDto = {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      engagementType: row.engagementType,
      version: row.version,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      phaseCount: row._count.templatePhases,
      milestoneCount: row._count.templateMilestones,
      taskCount: row._count.templateTasks,
    };

    if (withDetails) {
      dto.phases = row.templatePhases.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        orderIndex: p.orderIndex,
        relativeStartDays: p.relativeStartDays,
        durationDays: p.durationDays,
      }));
      dto.milestones = row.templateMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        relativeTargetDays: m.relativeTargetDays,
        weight: m.weight == null ? null : Number(m.weight),
        templatePhaseId: m.templatePhaseId,
      }));
      dto.tasks = row.templateTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        relativeStartDays: t.relativeStartDays,
        durationDays: t.durationDays,
        priority: t.priority,
        effortHours: t.effortHours,
        templatePhaseId: t.templatePhaseId,
        parentId: t.parentId,
      }));
    }

    return dto;
  }
}
