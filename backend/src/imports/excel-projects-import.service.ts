import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BillingModel,
  EngagementType,
  PhaseStatus,
  PriorityLevel,
  Prisma,
  ProjectMethodology,
  ProjectStatus,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogsService } from '../audit/audit-logs.service';
import { CaslUserContext } from '../casl/casl.types';
import { ProjectsService } from '../projects/projects.service';
import { FxService } from '../fx/fx.service';
import {
  ApiBillingModel,
  ApiCurrencyCode,
  ApiEngagementType,
  ApiPriorityLevel,
  ApiProjectMethodology,
  ApiProjectStatus,
} from '../projects/enums/project-api.enum';
import {
  toPrismaBillingModel,
  toPrismaEngagementType,
  toPrismaMethodology,
  toPrismaStatus,
} from '../projects/mappers/project.mapper';
import {
  ExcelMilestoneImportRow,
  ExcelPhaseImportRow,
  ExcelProjectImportRow,
  ExcelProjectsImportJobData,
  ExcelTaskImportRow,
  ImportJobResultSummary,
} from './imports.types';
import {
  applyExcelTaskParentLinks,
  createImportRowIdCursor,
  createTaskTitleIndex,
  idForTitle,
  indexExistingTask,
  indexTaskId,
  reindexImportRowKeys,
} from './excel-task-parents.util';

type ProgressFn = (percent: number, step: string) => Promise<void>;

type DepPlan = {
  predecessorId: string;
  successorId: string;
  depType: string;
  lagDays: number;
};

const PHASE_CHUNK = 100;
const TASK_CHUNK = 500;
const MILESTONE_CHUNK = 200;
const DEP_LOOKUP_CHUNK = 200;
const DEP_WRITE_CHUNK = 500;
const UPDATE_TX_CHUNK = 100;

@Injectable()
export class ExcelProjectsImportService {
  private readonly logger = new Logger(ExcelProjectsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly auditLogs: AuditLogsService,
    private readonly fx: FxService,
  ) {}

  async run(
    data: ExcelProjectsImportJobData,
    onProgress?: ProgressFn,
  ): Promise<ImportJobResultSummary> {
    await this.loadCaslUser(data.userId);
    const projects = data.projects;
    const total = Math.max(projects.length, 1);

    let projectsCreated = 0;
    let projectsUpdated = 0;
    let phasesCreated = 0;
    let phasesUpdated = 0;
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let milestonesCreated = 0;
    let milestonesUpdated = 0;
    let dependenciesCreated = 0;
    let dependenciesUpdated = 0;
    let failed = 0;
    const warnings: string[] = [];

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];
      const basePercent = Math.round((i / total) * 100);
      await onProgress?.(
        basePercent,
        `${proj.importMode === 'update' ? 'Updating' : 'Creating'} project ${i + 1} of ${projects.length}: ${proj.name}`,
      );

      try {
        let projectId: string;
        if (proj.importMode === 'update' && proj.resolvedProjectId) {
          const value = proj.value > 0 ? proj.value : 1;
          const usd = await this.fx.convertToUsd(value, proj.currency);
          await this.prisma.project.update({
            where: { id: proj.resolvedProjectId },
            data: {
              name: proj.name,
              objective: proj.objective,
              departmentId: proj.resolvedDepartmentId,
              customerId: proj.resolvedCustomerId,
              engagementType: this.mapEngagement(proj.engagementType),
              billingModel: this.mapBilling(proj.billingModel),
              ...(proj.methodology
                ? { methodology: this.mapMethodology(proj.methodology) }
                : {}),
              priority: this.mapPriority(proj.priority),
              startDate: this.requireDate(proj.startDate, 'startDate'),
              endDate: this.requireDate(proj.endDate, 'endDate'),
              value,
              currency: proj.currency as never,
              valueUsd: usd?.valueUsd ?? null,
              fxRateToUsd: usd?.fxRateToUsd ?? null,
              fxRateAt: usd?.fxRateAt ?? null,
              primaryPmId: proj.resolvedPrimaryPmId,
              secondaryPmId: proj.resolvedSecondaryPmId || null,
              ...(proj.status ? { status: this.mapProjectStatus(proj.status) } : {}),
              ...this.optionalProjectSchedule(proj),
            },
          });
          projectId = proj.resolvedProjectId;
          projectsUpdated += 1;
        } else {
          const created = await this.projectsService.create(
            {
              name: proj.name,
              objective: proj.objective,
              departmentId: proj.resolvedDepartmentId,
              customerId: proj.resolvedCustomerId,
              engagementType: proj.engagementType as ApiEngagementType,
              billingModel: proj.billingModel as ApiBillingModel,
              methodology: proj.methodology
                ? (proj.methodology as ApiProjectMethodology)
                : ApiProjectMethodology.Agile,
              priority: proj.priority as ApiPriorityLevel,
              startDate: this.requireDate(proj.startDate, 'startDate'),
              endDate: this.requireDate(proj.endDate, 'endDate'),
              value: proj.value > 0 ? proj.value : 1,
              currency: proj.currency as ApiCurrencyCode,
              primaryPmId: proj.resolvedPrimaryPmId,
              secondaryPmId: proj.resolvedSecondaryPmId || undefined,
              status: (proj.status as ApiProjectStatus) || ApiProjectStatus.Draft,
            },
            data.userId,
          );
          projectId = created.id;
          projectsCreated += 1;
          const extra = this.optionalProjectSchedule(proj);
          if (Object.keys(extra).length > 0) {
            await this.prisma.project.update({
              where: { id: projectId },
              data: extra,
            });
          }
        }

        // Order preserved: phases → tasks (+ deps) → milestones
        const phaseNameToId = await this.importPhases(
          projectId,
          data.phasesByProject[proj.name] ?? [],
          this.requireDate(proj.startDate, 'startDate'),
          this.requireDate(proj.endDate, 'endDate'),
          (step) => onProgress?.(basePercent, step),
        );
        phasesCreated += phaseNameToId.created;
        phasesUpdated += phaseNameToId.updated;

        if (phaseNameToId.ids.size === 0) {
          const fallback = await this.prisma.projectPhase.create({
            data: {
              projectId,
              name: 'Phase 1',
              orderIndex: 1,
              status: PhaseStatus.Planned,
              startDate: this.requireDate(proj.startDate, 'startDate'),
              endDate: this.requireDate(proj.endDate, 'endDate'),
            },
          });
          phaseNameToId.ids.set(fallback.name.toLowerCase(), fallback.id);
          phasesCreated += 1;
        }

        const taskResult = await this.importTasks(
          projectId,
          data.tasksByProject[proj.name] ?? [],
          phaseNameToId.ids,
          (step) => onProgress?.(basePercent, step),
        );
        tasksCreated += taskResult.created;
        tasksUpdated += taskResult.updated;
        dependenciesCreated += taskResult.depsCreated;
        dependenciesUpdated += taskResult.depsUpdated;
        warnings.push(...taskResult.warnings);

        const msResult = await this.importMilestones(
          projectId,
          data.milestonesByProject[proj.name] ?? [],
          phaseNameToId.ids,
          (step) => onProgress?.(basePercent, step),
        );
        milestonesCreated += msResult.created;
        milestonesUpdated += msResult.updated;
        warnings.push(...msResult.warnings);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Project "${proj.name}": ${message}`);
        this.logger.warn(
          `Excel project import failed for "${proj.name}": ${message}`,
        );
      }
    }

    await onProgress?.(100, 'Done');

    const summary: ImportJobResultSummary = {
      kind: 'excel-projects',
      projectsCreated,
      projectsUpdated,
      phasesCreated,
      phasesUpdated,
      tasksCreated,
      tasksUpdated,
      milestonesCreated,
      milestonesUpdated,
      dependenciesCreated,
      dependenciesUpdated,
      failed,
      warnings: warnings.slice(0, 50),
      message: `Excel projects import: ${projectsCreated} created, ${projectsUpdated} updated`,
    };

    await this.auditLogs.create({
      user: { connect: { id: data.userId } },
      action: 'IMPORT_EXCEL_PROJECTS',
      objectType: 'Project',
      description: summary.message,
      newValue: summary as object,
      isExternal: false,
    });

    return summary;
  }

  private async importPhases(
    projectId: string,
    rows: ExcelPhaseImportRow[],
    projectStart: Date,
    projectEnd: Date,
    onStep: (step: string) => Promise<void> | void,
  ): Promise<{
    ids: Map<string, string>;
    created: number;
    updated: number;
  }> {
    const ids = new Map<string, string>();
    let created = 0;
    let updated = 0;

    const existing = await this.prisma.projectPhase.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    for (const phase of existing) {
      ids.set(phase.name.trim().toLowerCase(), phase.id);
    }

    if (rows.length === 0) {
      return { ids, created, updated };
    }

    await onStep(`Importing ${rows.length} phases…`);

    const toCreate = rows.filter(
      (r) => !(r.importMode === 'update' && r.resolvedPhaseId),
    );
    const toUpdate = rows.filter(
      (r) => r.importMode === 'update' && r.resolvedPhaseId,
    );

    for (const chunk of this.chunk(toCreate, PHASE_CHUNK)) {
      const data: Prisma.ProjectPhaseCreateManyInput[] = chunk.map(
        (row, index) => ({
          projectId,
          name: row.name,
          description: row.description ?? null,
          orderIndex: row.orderIndex ?? ids.size + index + 1,
                status: this.mapPhaseStatus(row.status),
          startDate: this.parseDate(row.startDate) ?? projectStart,
          endDate: this.parseDate(row.endDate) ?? projectEnd,
        }),
      );

      try {
        const inserted = await this.prisma.projectPhase.createManyAndReturn({
          data,
          select: { id: true, name: true },
        });
        for (let i = 0; i < inserted.length; i++) {
          ids.set(chunk[i].name.trim().toLowerCase(), inserted[i].id);
        }
        created += inserted.length;
      } catch (error) {
        this.logger.warn(
          `Phase bulk create failed; falling back: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        for (const row of chunk) {
          const phase = await this.prisma.projectPhase.create({
            data: {
              projectId,
              name: row.name,
              description: row.description ?? null,
              orderIndex: row.orderIndex ?? ids.size + 1,
                status: this.mapPhaseStatus(row.status),
              startDate: this.parseDate(row.startDate) ?? projectStart,
              endDate: this.parseDate(row.endDate) ?? projectEnd,
            },
            select: { id: true, name: true },
          });
          ids.set(row.name.trim().toLowerCase(), phase.id);
          created += 1;
        }
      }
    }

    for (const chunk of this.chunk(toUpdate, UPDATE_TX_CHUNK)) {
      try {
        await this.prisma.$transaction(
          chunk.map((row) =>
            this.prisma.projectPhase.update({
              where: { id: row.resolvedPhaseId! },
              data: {
                name: row.name,
                description: row.description,
                orderIndex: row.orderIndex,
                status: this.mapPhaseStatus(row.status),
                startDate: this.parseDate(row.startDate) ?? undefined,
                endDate: this.parseDate(row.endDate) ?? undefined,
              },
            }),
          ),
        );
        for (const row of chunk) {
          ids.set(row.name.trim().toLowerCase(), row.resolvedPhaseId!);
          updated += 1;
        }
      } catch {
        for (const row of chunk) {
          await this.prisma.projectPhase.update({
            where: { id: row.resolvedPhaseId! },
            data: {
              name: row.name,
              description: row.description,
              orderIndex: row.orderIndex,
              status: this.mapPhaseStatus(row.status),
              startDate: this.parseDate(row.startDate) ?? undefined,
              endDate: this.parseDate(row.endDate) ?? undefined,
            },
          });
          ids.set(row.name.trim().toLowerCase(), row.resolvedPhaseId!);
          updated += 1;
        }
      }
    }

    return { ids, created, updated };
  }

  private async importTasks(
    projectId: string,
    rows: ExcelTaskImportRow[],
    phaseNameToId: Map<string, string>,
    onStep: (step: string) => Promise<void> | void,
  ) {
    let created = 0;
    let updated = 0;
    let depsCreated = 0;
    let depsUpdated = 0;
    const warnings: string[] = [];
    const titleIndex = createTaskTitleIndex();
    const phaseIds = new Set(phaseNameToId.values());

    const [existing, project] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          parentTask: { select: { title: true } },
        },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { startDate: true, endDate: true },
      }),
    ]);
    for (const task of existing) {
      indexExistingTask(titleIndex, task.title, task.id);
    }

    await this.ensureMissingPhases(
      projectId,
      rows,
      phaseNameToId,
      phaseIds,
      project?.startDate ?? new Date(),
      project?.endDate ?? new Date(),
      warnings,
    );

    if (rows.length === 0) {
      return { created, updated, depsCreated, depsUpdated, warnings };
    }

    type Prepared = {
      row: ExcelTaskImportRow;
      mode: 'create' | 'update';
      phaseId: string;
      startDate: Date;
      endDate: Date;
      progressApproved: number;
      importedId?: string;
    };

    const prepared: Prepared[] = [];
    for (const row of rows) {
      const fromId =
        row.resolvedPhaseId && phaseIds.has(row.resolvedPhaseId)
          ? row.resolvedPhaseId
          : null;
      const fromName = row.phaseName?.trim()
        ? phaseNameToId.get(row.phaseName.trim().toLowerCase())
        : undefined;
      const phaseId = fromId || fromName;
      if (!phaseId) {
        warnings.push(
          row.phaseName?.trim()
            ? `Task "${row.title}" skipped: phase "${row.phaseName.trim()}" was not found.`
            : `Task "${row.title}" skipped: no phase name. This row was not assigned to the first phase.`,
        );
        continue;
      }
      const startDate = this.parseDate(row.startDate) ?? new Date();
      const endDate = this.parseDate(row.endDate) ?? startDate;
      prepared.push({
        row,
        mode:
          row.importMode === 'update' && row.resolvedTaskId
            ? 'update'
            : 'create',
        phaseId,
        startDate,
        endDate,
        progressApproved:
          row.progressApproved != null
            ? Math.max(0, Math.min(100, Math.round(row.progressApproved)))
            : 0,
      });
    }

    const toCreate = prepared.filter((p) => p.mode === 'create');
    const toUpdate = prepared.filter((p) => p.mode === 'update');

    const createChunks = this.chunk(toCreate, TASK_CHUNK);
    for (let c = 0; c < createChunks.length; c++) {
      const chunk = createChunks[c];
      await onStep(
        `Creating tasks batch ${c + 1}/${createChunks.length} (${chunk.length})`,
      );
      const data: Prisma.TaskCreateManyInput[] = chunk.map((p) => ({
        projectId,
        phaseId: p.phaseId,
        title: p.row.title,
        description: p.row.description ?? null,
        priority: this.mapPriority(p.row.priority),
        status: this.mapStatus(p.row.status),
        ownerId: p.row.resolvedAssigneeId ?? null,
        startDate: p.startDate,
        endDate: p.endDate,
        effortHours: this.mapEffortHours(p.row.effortHours),
        durationDays: p.row.durationDays ?? null,
        baselineStart: this.parseDate(p.row.baselineStart),
        baselineEnd: this.parseDate(p.row.baselineEnd),
        baselineDurationDays: p.row.baselineDurationDays ?? null,
        actualStart: this.parseDate(p.row.actualStart),
        actualEnd: this.parseDate(p.row.actualEnd),
        progressApproved: p.progressApproved,
      }));

      try {
        const inserted = await this.prisma.task.createManyAndReturn({
          data,
          select: { id: true, title: true },
        });
        for (let i = 0; i < inserted.length; i++) {
          chunk[i].importedId = inserted[i].id;
          indexTaskId(
            titleIndex,
            chunk[i].row.title,
            inserted[i].id,
            chunk[i].row.parentTaskTitle,
          );
        }
        created += inserted.length;
      } catch (error) {
        this.logger.warn(
          `Task bulk create failed; falling back: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        for (const p of chunk) {
          try {
            const task = await this.prisma.task.create({
              data: {
                projectId,
                phaseId: p.phaseId,
                title: p.row.title,
                description: p.row.description ?? null,
                priority: this.mapPriority(p.row.priority),
                status: this.mapStatus(p.row.status),
                ownerId: p.row.resolvedAssigneeId ?? null,
                startDate: p.startDate,
                endDate: p.endDate,
                effortHours: this.mapEffortHours(p.row.effortHours),
                durationDays: p.row.durationDays ?? null,
                baselineStart: this.parseDate(p.row.baselineStart),
                baselineEnd: this.parseDate(p.row.baselineEnd),
                baselineDurationDays: p.row.baselineDurationDays ?? null,
                actualStart: this.parseDate(p.row.actualStart),
                actualEnd: this.parseDate(p.row.actualEnd),
                progressApproved: p.progressApproved,
              },
              select: { id: true, title: true },
            });
            indexTaskId(
              titleIndex,
              task.title,
              task.id,
              p.row.parentTaskTitle,
            );
            p.importedId = task.id;
            created += 1;
          } catch (rowError) {
            warnings.push(
              `Task "${p.row.title}": ${
                rowError instanceof Error ? rowError.message : String(rowError)
              }`,
            );
          }
        }
      }
    }

    const updateChunks = this.chunk(toUpdate, UPDATE_TX_CHUNK);
    for (let c = 0; c < updateChunks.length; c++) {
      const chunk = updateChunks[c];
      await onStep(
        `Updating tasks batch ${c + 1}/${updateChunks.length} (${chunk.length})`,
      );
      try {
        await this.prisma.$transaction(
          chunk.map((p) =>
            this.prisma.task.update({
              where: { id: p.row.resolvedTaskId! },
              data: {
                title: p.row.title,
                description: p.row.description ?? null,
                priority: this.mapPriority(p.row.priority),
                status: this.mapStatus(p.row.status),
                ownerId: p.row.resolvedAssigneeId ?? null,
                phaseId: p.phaseId,
                startDate: p.startDate,
                endDate: p.endDate,
                effortHours: this.mapEffortHours(p.row.effortHours),
                durationDays: p.row.durationDays ?? null,
                baselineStart: this.parseDate(p.row.baselineStart),
                baselineEnd: this.parseDate(p.row.baselineEnd),
                baselineDurationDays: p.row.baselineDurationDays ?? null,
                actualStart: this.parseDate(p.row.actualStart),
                actualEnd: this.parseDate(p.row.actualEnd),
                progressApproved: p.progressApproved,
              },
            }),
          ),
        );
        for (const p of chunk) {
          indexTaskId(
            titleIndex,
            p.row.title,
            p.row.resolvedTaskId!,
            p.row.parentTaskTitle,
          );
          p.importedId = p.row.resolvedTaskId;
          updated += 1;
        }
      } catch {
        for (const p of chunk) {
          try {
            await this.prisma.task.update({
              where: { id: p.row.resolvedTaskId! },
              data: {
                title: p.row.title,
                description: p.row.description ?? null,
                priority: this.mapPriority(p.row.priority),
                status: this.mapStatus(p.row.status),
                ownerId: p.row.resolvedAssigneeId ?? null,
                phaseId: p.phaseId,
                startDate: p.startDate,
                endDate: p.endDate,
                effortHours: this.mapEffortHours(p.row.effortHours),
                durationDays: p.row.durationDays ?? null,
                baselineStart: this.parseDate(p.row.baselineStart),
                baselineEnd: this.parseDate(p.row.baselineEnd),
                baselineDurationDays: p.row.baselineDurationDays ?? null,
                actualStart: this.parseDate(p.row.actualStart),
                actualEnd: this.parseDate(p.row.actualEnd),
                progressApproved: p.progressApproved,
              },
            });
            indexTaskId(
              titleIndex,
              p.row.title,
              p.row.resolvedTaskId!,
              p.row.parentTaskTitle,
            );
            p.importedId = p.row.resolvedTaskId;
            updated += 1;
          } catch (rowError) {
            warnings.push(
              `Task "${p.row.title}": ${
                rowError instanceof Error ? rowError.message : String(rowError)
              }`,
            );
          }
        }
      }
    }

    // Dependencies after all tasks exist — preserves FS chains by title
    await onStep('Linking task predecessors…');
    reindexImportRowKeys(
      titleIndex,
      prepared.map((p) => ({
        title: p.row.title,
        id: p.importedId,
        parentTaskTitle: p.row.parentTaskTitle,
      })),
    );
    const depPlans: DepPlan[] = [];
    const seenPairs = new Set<string>();
    const nextImportId = createImportRowIdCursor(titleIndex);
    for (const p of prepared) {
      const successorId = nextImportId(p.row.title, p.row.parentTaskTitle);
      if (!successorId || !p.row.predecessors?.length) continue;
      for (const pred of p.row.predecessors) {
        const { id: predecessorId, ambiguous } = idForTitle(
          titleIndex,
          pred.predecessorTitle,
        );
        if (!predecessorId || predecessorId === successorId) continue;
        if (ambiguous) {
          warnings.push(
            `Predecessor "${pred.predecessorTitle}" matches more than one task; linked the first match to "${p.row.title}".`,
          );
        }
        const key = `${predecessorId}|${successorId}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        depPlans.push({
          predecessorId,
          successorId,
          depType: pred.depType || 'FS',
          lagDays: pred.lagDays ?? 0,
        });
      }
    }

    if (depPlans.length > 0) {
      const byPair = new Map<string, string>();
      for (const lookup of this.chunk(depPlans, DEP_LOOKUP_CHUNK)) {
        const existingDeps = await this.prisma.taskDependency.findMany({
          where: {
            OR: lookup.map((plan) => ({
              predecessorId: plan.predecessorId,
              successorId: plan.successorId,
            })),
          },
          select: { id: true, predecessorId: true, successorId: true },
        });
        for (const dep of existingDeps) {
          byPair.set(`${dep.predecessorId}|${dep.successorId}`, dep.id);
        }
      }

      const toCreateDeps: DepPlan[] = [];
      const toUpdateDeps: Array<DepPlan & { id: string }> = [];
      for (const plan of depPlans) {
        const existingId = byPair.get(
          `${plan.predecessorId}|${plan.successorId}`,
        );
        if (existingId) toUpdateDeps.push({ ...plan, id: existingId });
        else toCreateDeps.push(plan);
      }

      for (const chunk of this.chunk(toCreateDeps, DEP_WRITE_CHUNK)) {
        try {
          const result = await this.prisma.taskDependency.createMany({
            data: chunk.map((plan) => ({
              predecessorId: plan.predecessorId,
              successorId: plan.successorId,
              depType: plan.depType,
              lagDays: plan.lagDays,
            })),
            skipDuplicates: true,
          });
          depsCreated += result.count;
        } catch (error) {
          warnings.push(
            `Dep bulk create: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          for (const plan of chunk) {
            try {
              await this.prisma.taskDependency.create({
                data: {
                  predecessorId: plan.predecessorId,
                  successorId: plan.successorId,
                  depType: plan.depType,
                  lagDays: plan.lagDays,
                },
              });
              depsCreated += 1;
            } catch (rowError) {
              warnings.push(
                `Dep link failed: ${
                  rowError instanceof Error
                    ? rowError.message
                    : String(rowError)
                }`,
              );
            }
          }
        }
      }

      for (const chunk of this.chunk(toUpdateDeps, UPDATE_TX_CHUNK)) {
        try {
          await this.prisma.$transaction(
            chunk.map((plan) =>
              this.prisma.taskDependency.update({
                where: { id: plan.id },
                data: { depType: plan.depType, lagDays: plan.lagDays },
              }),
            ),
          );
          depsUpdated += chunk.length;
        } catch {
          for (const plan of chunk) {
            try {
              await this.prisma.taskDependency.update({
                where: { id: plan.id },
                data: { depType: plan.depType, lagDays: plan.lagDays },
              });
              depsUpdated += 1;
            } catch (rowError) {
              warnings.push(
                `Dep link failed: ${
                  rowError instanceof Error
                    ? rowError.message
                    : String(rowError)
                }`,
              );
            }
          }
        }
      }
    }

    await onStep('Linking parent tasks…');
    await applyExcelTaskParentLinks(
      this.prisma,
      prepared.map((p) => p.row),
      titleIndex,
      warnings,
    );

    return {
      created,
      updated,
      depsCreated,
      depsUpdated,
      warnings,
    };
  }

  private async ensureMissingPhases(
    projectId: string,
    rows: Array<{ phaseName?: string; resolvedPhaseId?: string | null }>,
    phaseNameToId: Map<string, string>,
    phaseIds: Set<string>,
    projectStart: Date,
    projectEnd: Date,
    warnings: string[],
  ): Promise<void> {
    const missing = new Map<string, string>();
    for (const row of rows) {
      const name = row.phaseName?.trim();
      if (!name) continue;
      if (row.resolvedPhaseId && phaseIds.has(row.resolvedPhaseId)) continue;
      const key = name.toLowerCase();
      if (phaseNameToId.has(key) || missing.has(key)) continue;
      missing.set(key, name);
    }
    if (missing.size === 0) return;

    const maxOrder = await this.prisma.projectPhase.aggregate({
      where: { projectId },
      _max: { orderIndex: true },
    });
    let orderIndex = maxOrder._max.orderIndex ?? 0;
    for (const name of missing.values()) {
      orderIndex += 1;
      const created = await this.prisma.projectPhase.create({
        data: {
          projectId,
          name,
          orderIndex,
          status: PhaseStatus.Planned,
          startDate: projectStart,
          endDate: projectEnd,
        },
        select: { id: true, name: true },
      });
      const key = created.name.trim().toLowerCase();
      phaseNameToId.set(key, created.id);
      phaseIds.add(created.id);
      warnings.push(`Created missing phase "${created.name}".`);
    }
  }

  private async importMilestones(
    projectId: string,
    rows: ExcelMilestoneImportRow[],
    phaseNameToId: Map<string, string>,
    onStep: (step: string) => Promise<void> | void,
  ) {
    let created = 0;
    let updated = 0;
    const warnings: string[] = [];

    if (rows.length === 0) {
      return { created, updated, warnings };
    }

    await onStep(`Importing ${rows.length} milestones…`);

    type PreparedMs = {
      row: ExcelMilestoneImportRow;
      mode: 'create' | 'update';
      phaseId: string | null;
      targetDate: Date;
    };

    const prepared: PreparedMs[] = rows.map((row) => {
      const phaseId =
        row.resolvedPhaseId ||
        (row.phaseName
          ? phaseNameToId.get(row.phaseName.trim().toLowerCase())
          : null) ||
        null;
      return {
        row,
        mode:
          row.importMode === 'update' && row.resolvedMilestoneId
            ? 'update'
            : 'create',
        phaseId,
        targetDate: this.parseDate(row.targetDate) ?? new Date(),
      };
    });

    const toCreate = prepared.filter((p) => p.mode === 'create');
    const toUpdate = prepared.filter((p) => p.mode === 'update');

    for (const chunk of this.chunk(toCreate, MILESTONE_CHUNK)) {
      try {
        const result = await this.prisma.projectMilestone.createMany({
          data: chunk.map((p) => ({
            projectId,
            title: p.row.title,
            targetDate: p.targetDate,
            weight: p.row.weight ?? null,
            status: p.row.status || 'Pending',
            phaseId: p.phaseId,
          })),
        });
        created += result.count;
      } catch {
        for (const p of chunk) {
          try {
            await this.prisma.projectMilestone.create({
              data: {
                projectId,
                title: p.row.title,
                targetDate: p.targetDate,
                weight: p.row.weight ?? null,
                status: p.row.status || 'Pending',
                phaseId: p.phaseId,
              },
            });
            created += 1;
          } catch (rowError) {
            warnings.push(
              `Milestone "${p.row.title}": ${
                rowError instanceof Error ? rowError.message : String(rowError)
              }`,
            );
          }
        }
      }
    }

    for (const chunk of this.chunk(toUpdate, UPDATE_TX_CHUNK)) {
      try {
        await this.prisma.$transaction(
          chunk.map((p) =>
            this.prisma.projectMilestone.update({
              where: { id: p.row.resolvedMilestoneId! },
              data: {
                title: p.row.title,
                targetDate: p.targetDate,
                weight: p.row.weight ?? null,
                status: p.row.status || 'Pending',
                phaseId: p.phaseId,
              },
            }),
          ),
        );
        updated += chunk.length;
      } catch {
        for (const p of chunk) {
          try {
            await this.prisma.projectMilestone.update({
              where: { id: p.row.resolvedMilestoneId! },
              data: {
                title: p.row.title,
                targetDate: p.targetDate,
                weight: p.row.weight ?? null,
                status: p.row.status || 'Pending',
                phaseId: p.phaseId,
              },
            });
            updated += 1;
          } catch (rowError) {
            warnings.push(
              `Milestone "${p.row.title}": ${
                rowError instanceof Error ? rowError.message : String(rowError)
              }`,
            );
          }
        }
      }
    }

    return { created, updated, warnings };
  }

  private chunk<T>(items: T[], size: number): T[][] {
    if (items.length === 0) return [];
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  private async loadCaslUser(userId: string): Promise<CaslUserContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        employees: { select: { departmentId: true } },
      },
    });
    if (!user?.role) {
      throw new BadRequestException('User not found');
    }
    return {
      id: user.id,
      roleId: user.roleId,
      roleCode: user.role.code,
      departmentId: user.employees?.departmentId ?? null,
    };
  }

  private requireDate(value: string, field: string): Date {
    const parsed = this.parseDate(value);
    if (!parsed) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return parsed;
  }

  private parseDate(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(
      value.length <= 10 ? `${value}T00:00:00.000Z` : value,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private optionalProjectSchedule(
    proj: ExcelProjectImportRow,
  ): Prisma.ProjectUncheckedUpdateInput {
    const data: Prisma.ProjectUncheckedUpdateInput = {};
    if (proj.methodology) {
      data.methodology = this.mapMethodology(proj.methodology);
    }
    if (proj.durationDays != null && Number.isFinite(proj.durationDays)) {
      data.durationDays = proj.durationDays;
    }
    const baselineStart = this.parseDate(proj.baselineStartDate);
    if (baselineStart) data.baselineStartDate = baselineStart;
    const baselineEnd = this.parseDate(proj.baselineEndDate);
    if (baselineEnd) data.baselineEndDate = baselineEnd;
    if (
      proj.baselineDurationDays != null &&
      Number.isFinite(proj.baselineDurationDays)
    ) {
      data.baselineDurationDays = proj.baselineDurationDays;
    }
    const actualStart = this.parseDate(proj.actualStartDate);
    if (actualStart) data.actualStartDate = actualStart;
    const actualEnd = this.parseDate(proj.actualEndDate);
    if (actualEnd) data.actualEndDate = actualEnd;
    if (proj.percentComplete != null && Number.isFinite(proj.percentComplete)) {
      data.percentComplete = Math.max(
        0,
        Math.min(100, Math.round(proj.percentComplete)),
      );
    }
    return data;
  }

  private mapEngagement(value: string): EngagementType {
    if (
      !Object.values(ApiEngagementType).includes(value as ApiEngagementType)
    ) {
      throw new BadRequestException(`Invalid engagement type "${value}"`);
    }
    return toPrismaEngagementType(value as ApiEngagementType);
  }

  private mapBilling(value: string): BillingModel {
    if (!Object.values(ApiBillingModel).includes(value as ApiBillingModel)) {
      throw new BadRequestException(`Invalid billing model "${value}"`);
    }
    return toPrismaBillingModel(value as ApiBillingModel);
  }

  private mapMethodology(value: string): ProjectMethodology {
    if (
      !Object.values(ApiProjectMethodology).includes(
        value as ApiProjectMethodology,
      )
    ) {
      throw new BadRequestException(`Invalid methodology "${value}"`);
    }
    return toPrismaMethodology(value as ApiProjectMethodology);
  }

  private mapProjectStatus(value: string): ProjectStatus {
    if (!Object.values(ApiProjectStatus).includes(value as ApiProjectStatus)) {
      throw new BadRequestException(`Invalid project status "${value}"`);
    }
    return toPrismaStatus(value as ApiProjectStatus);
  }

  private mapPhaseStatus(value?: string): PhaseStatus {
    switch (value) {
      case 'Active':
        return PhaseStatus.Active;
      case 'Completed':
        return PhaseStatus.Completed;
      case 'On_Hold':
        return PhaseStatus.On_Hold;
      default:
        return PhaseStatus.Planned;
    }
  }

  private mapEffortHours(value?: number): number | null {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.max(0, Math.round(value));
  }

  private mapPriority(value?: string): PriorityLevel {
    switch (value) {
      case 'Critical':
        return PriorityLevel.Critical;
      case 'High':
        return PriorityLevel.High;
      case 'Low':
        return PriorityLevel.Low;
      default:
        return PriorityLevel.Medium;
    }
  }

  private mapStatus(value?: string): TaskStatus {
    switch (value) {
      case 'In_Progress':
        return TaskStatus.In_Progress;
      case 'Submitted_for_Review':
        return TaskStatus.Submitted_for_Review;
      case 'Approved':
        return TaskStatus.Approved;
      case 'Rework':
        return TaskStatus.Rework;
      case 'Done':
        return TaskStatus.Done;
      default:
        return TaskStatus.To_Do;
    }
  }
}
