import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PhaseStatus, PriorityLevel, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogsService } from '../audit/audit-logs.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import {
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
import { TASK_ASSIGNEE_ORG_ROLE_CODES } from '../roles/roles.enum';

type ProgressFn = (percent: number, step: string) => Promise<void>;

type PreparedTaskRow = {
  source: ExcelTaskImportRow;
  importMode: 'create' | 'update';
  resolvedTaskId?: string;
  phaseId: string;
  ownerId: string | null;
  startDate: Date;
  endDate: Date;
  priority: PriorityLevel;
  status: TaskStatus;
  progressApproved: number;
  baselineStart: Date | null;
  baselineEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  importedId?: string;
};

type DepPlan = {
  predecessorId: string;
  successorId: string;
  depType: string;
  lagDays: number;
};

const TASK_CHUNK_SIZE = 500;
const DEP_LOOKUP_CHUNK = 200;
const DEP_WRITE_CHUNK = 500;
const UPDATE_TX_CHUNK = 100;

@Injectable()
export class ExcelTasksImportService {
  private readonly logger = new Logger(ExcelTasksImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async run(
    userId: string,
    projectId: string,
    rows: ExcelTaskImportRow[],
    onProgress?: ProgressFn,
  ): Promise<ImportJobResultSummary> {
    const user = await this.loadCaslUser(userId);
    await this.assertProjectAccessible(user, projectId);

    const [project, projectPhases, projectTasks, teamUserIds] =
      await Promise.all([
        this.prisma.project.findUnique({
          where: { id: projectId },
          select: { startDate: true, endDate: true },
        }),
        this.prisma.projectPhase.findMany({
          where: { projectId },
          select: { id: true, name: true },
        }),
        this.prisma.task.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            parentTask: { select: { title: true } },
          },
        }),
        this.prisma.allocation.findMany({
          where: { projectId, status: 'Active' },
          select: { employee: { select: { userId: true } } },
        }),
      ]);

    const namedPhaseRows = rows.some((r) => r.phaseName?.trim());
    if (projectPhases.length === 0 && !namedPhaseRows) {
      throw new BadRequestException(
        'Project has no phases. Create a phase before importing tasks.',
      );
    }

    const phaseIds = new Set(projectPhases.map((p) => p.id));
    const phaseNameToId = new Map(
      projectPhases.map((p) => [p.name.trim().toLowerCase(), p.id]),
    );
    const taskIds = new Set(projectTasks.map((t) => t.id));
    const assigneeIds = new Set(
      teamUserIds
        .map((a) => a.employee?.userId)
        .filter((id): id is string => Boolean(id)),
    );

    const projectPms = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { primaryPmId: true, secondaryPmId: true },
    });
    if (projectPms?.primaryPmId) assigneeIds.add(projectPms.primaryPmId);
    if (projectPms?.secondaryPmId) assigneeIds.add(projectPms.secondaryPmId);

    const orgRoleUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: TASK_ASSIGNEE_ORG_ROLE_CODES } },
      },
      select: { id: true },
    });
    for (const user of orgRoleUsers) {
      assigneeIds.add(user.id);
    }

    const warnings: string[] = [];
    const titleIndex = createTaskTitleIndex();
    for (const task of projectTasks) {
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

    await onProgress?.(5, 'Preparing task rows…');

    const prepared: PreparedTaskRow[] = [];
    for (const raw of rows) {
      const row = this.sanitizeImportRow(raw, {
        phaseIds,
        taskIds,
        assigneeIds,
      });
      const phaseId =
        (row.resolvedPhaseId && phaseIds.has(row.resolvedPhaseId)
          ? row.resolvedPhaseId
          : null) ||
        (row.phaseName?.trim()
          ? phaseNameToId.get(row.phaseName.trim().toLowerCase())
          : undefined);
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
        source: row,
        importMode: row.importMode,
        resolvedTaskId: row.resolvedTaskId,
        phaseId,
        ownerId:
          row.resolvedAssigneeId && assigneeIds.has(row.resolvedAssigneeId)
            ? row.resolvedAssigneeId
            : null,
        startDate,
        endDate,
        priority: this.mapPriority(row.priority),
        status: this.mapStatus(row.status),
        progressApproved:
          row.progressApproved != null
            ? Math.max(0, Math.min(100, Math.round(row.progressApproved)))
            : 0,
        baselineStart: this.parseDate(row.baselineStart),
        baselineEnd: this.parseDate(row.baselineEnd),
        actualStart: this.parseDate(row.actualStart),
        actualEnd: this.parseDate(row.actualEnd),
      });
    }

    const toCreate = prepared.filter((r) => r.importMode !== 'update');
    const toUpdate = prepared.filter(
      (r) => r.importMode === 'update' && r.resolvedTaskId,
    );

    let tasksCreated = 0;
    let tasksUpdated = 0;
    let failed = 0;

    // ── Creates (bulk) — phaseId set on every row ─────────────────────────
    const createChunks = this.chunk(toCreate, TASK_CHUNK_SIZE);
    for (let c = 0; c < createChunks.length; c++) {
      const chunk = createChunks[c];
      await onProgress?.(
        5 + Math.round(((c + 1) / Math.max(createChunks.length, 1)) * 50),
        `Creating tasks batch ${c + 1} of ${createChunks.length} (${chunk.length} rows)`,
      );

      const data: Prisma.TaskCreateManyInput[] = chunk.map((row) => ({
        projectId,
        phaseId: row.phaseId,
        title: row.source.title,
        description: row.source.description ?? null,
        priority: row.priority,
        status: row.status,
        ownerId: row.ownerId,
        startDate: row.startDate,
        endDate: row.endDate,
        effortHours: this.mapEffortHours(row.source.effortHours),
        durationDays: row.source.durationDays ?? null,
        baselineStart: row.baselineStart,
        baselineEnd: row.baselineEnd,
        baselineDurationDays: row.source.baselineDurationDays ?? null,
        actualStart: row.actualStart,
        actualEnd: row.actualEnd,
        progressApproved: row.progressApproved,
      }));

      try {
        const created = await this.prisma.task.createManyAndReturn({
          data,
          select: { id: true, title: true },
        });
        // Prefer input order so title→id mapping stays correct even with duplicate titles
        for (let i = 0; i < created.length; i++) {
          chunk[i].importedId = created[i].id;
          indexTaskId(
            titleIndex,
            chunk[i].source.title,
            created[i].id,
            chunk[i].source.parentTaskTitle,
          );
        }
        tasksCreated += created.length;
      } catch (error) {
        // Fall back per-row so one bad row doesn't drop the whole batch
        this.logger.warn(
          `Bulk create batch ${c + 1} failed; falling back to per-row: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        for (const row of chunk) {
          try {
            const created = await this.prisma.task.create({
              data: {
                projectId,
                phaseId: row.phaseId,
                title: row.source.title,
                description: row.source.description ?? null,
                priority: row.priority,
                status: row.status,
                ownerId: row.ownerId,
                startDate: row.startDate,
                endDate: row.endDate,
                effortHours: this.mapEffortHours(row.source.effortHours),
                durationDays: row.source.durationDays ?? null,
                baselineStart: row.baselineStart,
                baselineEnd: row.baselineEnd,
                baselineDurationDays: row.source.baselineDurationDays ?? null,
                actualStart: row.actualStart,
                actualEnd: row.actualEnd,
                progressApproved: row.progressApproved,
              },
              select: { id: true, title: true },
            });
            indexTaskId(
              titleIndex,
              created.title,
              created.id,
              row.source.parentTaskTitle,
            );
            row.importedId = created.id;
            tasksCreated += 1;
          } catch (rowError) {
            failed += 1;
            const message =
              rowError instanceof Error ? rowError.message : String(rowError);
            warnings.push(`Task "${row.source.title}": ${message}`);
          }
        }
      }
    }

    // ── Updates (chunked transactions) — keep phaseId / dates / owners ────
    const updateChunks = this.chunk(toUpdate, UPDATE_TX_CHUNK);
    for (let c = 0; c < updateChunks.length; c++) {
      const chunk = updateChunks[c];
      await onProgress?.(
        55 + Math.round(((c + 1) / Math.max(updateChunks.length, 1)) * 25),
        `Updating tasks batch ${c + 1} of ${updateChunks.length}`,
      );

      try {
        await this.prisma.$transaction(
          chunk.map((row) =>
            this.prisma.task.update({
              where: { id: row.resolvedTaskId! },
              data: {
                title: row.source.title,
                description: row.source.description ?? null,
                priority: row.priority,
                status: row.status,
                ownerId: row.ownerId,
                phaseId: row.phaseId,
                startDate: row.startDate,
                endDate: row.endDate,
                effortHours: this.mapEffortHours(row.source.effortHours),
                durationDays: row.source.durationDays ?? null,
                baselineStart: row.baselineStart,
                baselineEnd: row.baselineEnd,
                baselineDurationDays: row.source.baselineDurationDays ?? null,
                actualStart: row.actualStart,
                actualEnd: row.actualEnd,
                progressApproved: row.progressApproved,
              },
            }),
          ),
        );
        for (const row of chunk) {
          indexTaskId(
            titleIndex,
            row.source.title,
            row.resolvedTaskId!,
            row.source.parentTaskTitle,
          );
          row.importedId = row.resolvedTaskId;
          tasksUpdated += 1;
        }
      } catch (error) {
        this.logger.warn(
          `Bulk update batch ${c + 1} failed; falling back to per-row: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        for (const row of chunk) {
          try {
            await this.prisma.task.update({
              where: { id: row.resolvedTaskId! },
              data: {
                title: row.source.title,
                description: row.source.description ?? null,
                priority: row.priority,
                status: row.status,
                ownerId: row.ownerId,
                phaseId: row.phaseId,
                startDate: row.startDate,
                endDate: row.endDate,
                effortHours: this.mapEffortHours(row.source.effortHours),
                durationDays: row.source.durationDays ?? null,
                baselineStart: row.baselineStart,
                baselineEnd: row.baselineEnd,
                baselineDurationDays: row.source.baselineDurationDays ?? null,
                actualStart: row.actualStart,
                actualEnd: row.actualEnd,
                progressApproved: row.progressApproved,
              },
            });
            indexTaskId(
              titleIndex,
              row.source.title,
              row.resolvedTaskId!,
              row.source.parentTaskTitle,
            );
            row.importedId = row.resolvedTaskId;
            tasksUpdated += 1;
          } catch (rowError) {
            failed += 1;
            const message =
              rowError instanceof Error ? rowError.message : String(rowError);
            warnings.push(`Task "${row.source.title}": ${message}`);
          }
        }
      }
    }

    // ── Dependencies AFTER all tasks exist (preserves FS chains by title) ─
    await onProgress?.(82, 'Resolving predecessor links…');
    reindexImportRowKeys(
      titleIndex,
      prepared.map((row) => ({
        title: row.source.title,
        id: row.importedId,
        parentTaskTitle: row.source.parentTaskTitle,
      })),
    );

    const depPlans: DepPlan[] = [];
    const seenPairs = new Set<string>();
    const nextImportId = createImportRowIdCursor(titleIndex);
    for (const row of prepared) {
      const successorId = nextImportId(
        row.source.title,
        row.source.parentTaskTitle,
      );
      if (!successorId || !row.source.predecessors?.length) continue;
      for (const pred of row.source.predecessors) {
        const { id: predecessorId, ambiguous } = idForTitle(
          titleIndex,
          pred.predecessorTitle,
        );
        if (!predecessorId) {
          warnings.push(
            `Predecessor "${pred.predecessorTitle}" not found for "${row.source.title}".`,
          );
          continue;
        }
        if (ambiguous) {
          warnings.push(
            `Predecessor "${pred.predecessorTitle}" matches more than one task; linked the first match to "${row.source.title}".`,
          );
        }
        if (predecessorId === successorId) continue;
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

    let dependenciesCreated = 0;
    let dependenciesUpdated = 0;

    if (depPlans.length > 0) {
      const byPair = new Map<string, string>();
      const lookupChunks = this.chunk(depPlans, DEP_LOOKUP_CHUNK);
      for (const lookup of lookupChunks) {
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
        const key = `${plan.predecessorId}|${plan.successorId}`;
        const existingId = byPair.get(key);
        if (existingId) {
          toUpdateDeps.push({ ...plan, id: existingId });
        } else {
          toCreateDeps.push(plan);
        }
      }

      const createDepChunks = this.chunk(toCreateDeps, DEP_WRITE_CHUNK);
      for (let c = 0; c < createDepChunks.length; c++) {
        const chunk = createDepChunks[c];
        await onProgress?.(
          85 + Math.round(((c + 1) / Math.max(createDepChunks.length, 1)) * 10),
          `Creating dependencies batch ${c + 1} of ${createDepChunks.length}`,
        );
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
          dependenciesCreated += result.count;
        } catch (error) {
          this.logger.warn(
            `Bulk dep create batch ${c + 1} failed; falling back: ${
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
              dependenciesCreated += 1;
            } catch (rowError) {
              const message =
                rowError instanceof Error ? rowError.message : String(rowError);
              warnings.push(`Dependency link failed: ${message}`);
            }
          }
        }
      }

      const updateDepChunks = this.chunk(toUpdateDeps, UPDATE_TX_CHUNK);
      for (let c = 0; c < updateDepChunks.length; c++) {
        const chunk = updateDepChunks[c];
        await onProgress?.(
          95 + Math.round(((c + 1) / Math.max(updateDepChunks.length, 1)) * 4),
          `Updating dependencies batch ${c + 1} of ${updateDepChunks.length}`,
        );
        try {
          await this.prisma.$transaction(
            chunk.map((plan) =>
              this.prisma.taskDependency.update({
                where: { id: plan.id },
                data: { depType: plan.depType, lagDays: plan.lagDays },
              }),
            ),
          );
          dependenciesUpdated += chunk.length;
        } catch (error) {
          for (const plan of chunk) {
            try {
              await this.prisma.taskDependency.update({
                where: { id: plan.id },
                data: { depType: plan.depType, lagDays: plan.lagDays },
              });
              dependenciesUpdated += 1;
            } catch (rowError) {
              const message =
                rowError instanceof Error ? rowError.message : String(rowError);
              warnings.push(`Dependency link failed: ${message}`);
            }
          }
        }
      }
    }

    await onProgress?.(98, 'Linking parent tasks…');
    await applyExcelTaskParentLinks(
      this.prisma,
      prepared.map((row) => row.source),
      titleIndex,
      warnings,
    );

    await onProgress?.(100, 'Done');

    const summary: ImportJobResultSummary = {
      kind: 'excel-tasks',
      tasksCreated,
      tasksUpdated,
      dependenciesCreated,
      dependenciesUpdated,
      failed,
      warnings: warnings.slice(0, 50),
      message: `Excel tasks import: ${tasksCreated} created, ${tasksUpdated} updated`,
    };

    await this.auditLogs.create({
      user: { connect: { id: userId } },
      action: 'IMPORT_EXCEL_TASKS',
      objectType: 'Project',
      objectId: projectId,
      description: summary.message,
      newValue: summary as object,
      isExternal: false,
    });

    return summary;
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

  private async assertProjectAccessible(
    user: CaslUserContext,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.recordScopeWhere.projectWhere(user, 'update'),
      },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException('Project not found or not accessible');
    }
  }

  /** Drop foreign IDs that do not belong to this project (do not trust the client). */
  private sanitizeImportRow(
    row: ExcelTaskImportRow,
    catalogs: {
      phaseIds: Set<string>;
      taskIds: Set<string>;
      assigneeIds: Set<string>;
    },
  ): ExcelTaskImportRow {
    let importMode = row.importMode;
    let resolvedTaskId = row.resolvedTaskId;
    let resolvedPhaseId = row.resolvedPhaseId ?? null;
    let resolvedAssigneeId = row.resolvedAssigneeId ?? null;

    if (resolvedPhaseId && !catalogs.phaseIds.has(resolvedPhaseId)) {
      resolvedPhaseId = null;
    }
    if (resolvedAssigneeId && !catalogs.assigneeIds.has(resolvedAssigneeId)) {
      resolvedAssigneeId = null;
    }
    if (
      importMode === 'update' &&
      (!resolvedTaskId || !catalogs.taskIds.has(resolvedTaskId))
    ) {
      importMode = 'create';
      resolvedTaskId = undefined;
    }

    return {
      ...row,
      importMode,
      resolvedTaskId,
      resolvedPhaseId,
      resolvedAssigneeId,
    };
  }

  private parseDate(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(
      value.length <= 10 ? `${value}T00:00:00.000Z` : value,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
