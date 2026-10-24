import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  MspdiExportAssignmentPayload,
  MspdiExportCustomFieldDef,
  MspdiExportDependencyPayload,
  MspdiExportHolidayPayload,
  MspdiExportRequestPayload,
  MspdiExportResourcePayload,
  MspdiExportTaskPayload,
} from './mspdi-export.types';
import {
  filterMspdiCycleDependencies,
  mergeCustomFieldDefsForExport,
} from './mspdi-export.local';
import {
  extraResourceNames,
  mergeExportResourceNames,
} from './resource-names.util';
import {
  resolveMspExportTimeZone,
  toMspdiDateTime,
} from './mspdi-datetime.util';

type PersonRow = {
  id: string;
  displayName: string;
  email: string | null;
  isExternal: boolean;
  employees: { department: { name: string } | null } | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  parentTaskId: string | null;
  phaseId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  baselineStart: Date | null;
  baselineEnd: Date | null;
  durationDays: unknown;
  baselineDurationDays: unknown;
  effortHours: number | null;
  progressApproved: number;
  status?: string | null;
  priority: string;
  createdAt: Date;
  ownerId: string | null;
  backupOwnerId: string | null;
  owner: PersonRow | null;
  backupOwner: PersonRow | null;
  resourceNames: string | null;
  mspCustomFields?: unknown;
  mspTaskMode?: string | null;
  mspConstraintType?: string | null;
  mspConstraintDate?: Date | null;
  isScheduleMilestone: boolean;
  isPhaseScheduleTask?: boolean;
};

@Injectable()
export class MspdiExportBuilder {
  private readonly logger = new Logger(MspdiExportBuilder.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Load project schedule and map to the payload expected by mpxj-service /export/mspdi.
   * Phases become summary rows; leaf tasks keep plan order (createdAt desc = import plan order).
   */
  async buildPayload(
    projectId: string,
    timeZone?: string,
  ): Promise<MspdiExportRequestPayload> {
    const tz = resolveMspExportTimeZone(timeZone);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        baselineStartDate: true,
        baselineEndDate: true,
        durationDays: true,
        baselineDurationDays: true,
        percentComplete: true,
        durationVarianceDays: true,
        mspCustomFieldDefs: true,
        customer: {
          select: { displayName: true, companyName: true },
        },
        department: { select: { name: true } },
        phases: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            startDate: true,
            endDate: true,
            orderIndex: true,
            taskId: true,
          },
        },
      },
    });

    const personSelect = {
      id: true,
      displayName: true,
      email: true,
      isExternal: true,
      employees: {
        select: {
          department: { select: { name: true } },
        },
      },
    } as const;

    const loadedTasks = await this.prisma.task.findMany({
      where: { projectId },
      // Match MPP import / task list: newest createdAt = first in plan.
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        parentTaskId: true,
        phaseId: true,
        startDate: true,
        endDate: true,
        baselineStart: true,
        baselineEnd: true,
        durationDays: true,
        baselineDurationDays: true,
        effortHours: true,
        progressApproved: true,
        status: true,
        priority: true,
        createdAt: true,
        ownerId: true,
        backupOwnerId: true,
        resourceNames: true,
        mspCustomFields: true,
        mspTaskMode: true,
        mspConstraintType: true,
        mspConstraintDate: true,
        owner: { select: personSelect },
        backupOwner: { select: personSelect },
        scheduleMilestone: { select: { id: true } },
        schedulePhase: { select: { id: true } },
      },
    });
    const tasks: TaskRow[] = loadedTasks.map((task) => ({
      ...task,
      isScheduleMilestone: Boolean(task.scheduleMilestone),
      isPhaseScheduleTask: Boolean(task.schedulePhase),
    }));

    const dependencies = await this.prisma.taskDependency.findMany({
      where: {
        OR: [
          { predecessor: { projectId } },
          { successor: { projectId } },
        ],
      },
      select: {
        predecessorId: true,
        successorId: true,
        depType: true,
        lagDays: true,
      },
    });

    const milestones = await this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: [{ phaseId: 'asc' }, { targetDate: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        targetDate: true,
        phaseId: true,
        status: true,
        taskId: true,
      },
    });

    const scheduleKey = (title: string, phaseId: string | null) =>
      `${phaseId ?? ''}|${title.trim().toLowerCase()}`;
    const milestoneKeys = new Set(
      milestones.map((m) => scheduleKey(m.title, m.phaseId)),
    );
    const taskKeys = new Set(
      tasks.map((t) => scheduleKey(t.title, t.phaseId)),
    );
    for (const task of tasks) {
      if (milestoneKeys.has(scheduleKey(task.title, task.phaseId))) {
        task.isScheduleMilestone = true;
      }
    }
    const isStandaloneMilestone = (m: (typeof milestones)[number]) =>
      !m.taskId && !taskKeys.has(scheduleKey(m.title, m.phaseId));

    const projectOrganization =
      project.customer?.displayName ||
      project.customer?.companyName ||
      project.department?.name ||
      '';

    const exportTasks: MspdiExportTaskPayload[] = [];
    const phaseIdByExportId = new Map<string, string>();
    const customFieldDefs =
      this.toCustomFieldDefsPayload(project.mspCustomFieldDefs) ?? [];

    const twinIds = new Set(
      project.phases
        .map((p) => p.taskId)
        .filter((id): id is string => Boolean(id)),
    );
    const workTasks = tasks.filter((t) => !t.isPhaseScheduleTask);
    const topLevel = workTasks.filter(
      (t) => !t.parentTaskId || twinIds.has(t.parentTaskId),
    );

    // L1 project summary under OL0 (MSP plan name above phases).
    const projectExportId = `project:${project.id}`;
    const projectRollup = this.rollupSchedule(
      workTasks,
      { startDate: project.startDate, endDate: project.endDate },
      tz,
    );
    exportTasks.push({
      id: projectExportId,
      name: project.name,
      summary: true,
      outlineLevel: 1,
      startDate: projectRollup.startDate,
      finishDate: projectRollup.finishDate,
      baselineStart: projectRollup.baselineStart,
      baselineFinish: projectRollup.baselineFinish,
      durationDays: projectRollup.durationDays,
      baselineDurationDays: projectRollup.baselineDurationDays,
      startVarianceDays: this.signedDayDelta(
        projectRollup.startDate,
        projectRollup.baselineStart,
      ),
      finishVarianceDays: this.signedDayDelta(
        projectRollup.finishDate,
        projectRollup.baselineFinish,
      ),
      durationVarianceDays:
        projectRollup.durationDays != null &&
          projectRollup.baselineDurationDays != null
          ? Math.round(
            (Number(projectRollup.durationDays) -
              Number(projectRollup.baselineDurationDays)) *
            10,
          ) / 10
          : undefined,
      percentComplete: projectRollup.percentComplete,
      priority: 500,
    });

    for (const phase of project.phases) {
      const phaseWork = workTasks.filter((t) => t.phaseId === phase.id);
      const twin = phase.taskId
        ? tasks.find((t) => t.id === phase.taskId)
        : undefined;
      const phaseExportId = twin?.id ?? `phase:${phase.id}`;
      phaseIdByExportId.set(phase.id, phaseExportId);

      if (twin) {
        const start = toMspdiDateTime(twin.startDate, false, tz);
        const finish = toMspdiDateTime(twin.endDate, true, tz);
        const baselineStart = toMspdiDateTime(twin.baselineStart, false, tz);
        const baselineFinish = toMspdiDateTime(twin.baselineEnd, true, tz);
        const durationDays =
          this.decimalToNumber(twin.durationDays) ??
          this.inclusiveDays(twin.startDate, twin.endDate);
        const baselineDurationDays =
          this.decimalToNumber(twin.baselineDurationDays) ??
          this.inclusiveDays(twin.baselineStart, twin.baselineEnd);
        exportTasks.push({
          id: twin.id,
          name: twin.title || phase.name,
          parentId: projectExportId,
          summary: true,
          outlineLevel: 2,
          startDate: start,
          finishDate: finish,
          baselineStart,
          baselineFinish,
          durationDays,
          baselineDurationDays,
          workHours: this.decimalToNumber(twin.effortHours),
          startVarianceDays: this.signedDayDelta(start, baselineStart),
          finishVarianceDays: this.signedDayDelta(finish, baselineFinish),
          durationVarianceDays:
            durationDays != null && baselineDurationDays != null
              ? Math.round(
                (Number(durationDays) - Number(baselineDurationDays)) * 10,
              ) / 10
              : undefined,
          percentComplete: Math.max(
            0,
            Math.min(100, twin.progressApproved ?? 0),
          ),
          priority: this.mapPriority(twin.priority),
          notes: twin.description ?? phase.description ?? undefined,
          resourceNames: this.mergedResourceNames(twin, projectOrganization),
          customFields: this.toCustomFieldsPayload(
            twin.mspCustomFields,
            customFieldDefs,
          ),
          ...this.mspScheduleMeta(twin, tz),
        });
      } else {
        const rollup = this.rollupSchedule(
          phaseWork,
          { startDate: phase.startDate, endDate: phase.endDate },
          tz,
        );
        exportTasks.push({
          id: phaseExportId,
          name: phase.name,
          parentId: projectExportId,
          summary: true,
          outlineLevel: 2,
          startDate: rollup.startDate,
          finishDate: rollup.finishDate,
          baselineStart: rollup.baselineStart,
          baselineFinish: rollup.baselineFinish,
          durationDays: rollup.durationDays,
          baselineDurationDays: rollup.baselineDurationDays,
          startVarianceDays: this.signedDayDelta(
            rollup.startDate,
            rollup.baselineStart,
          ),
          finishVarianceDays: this.signedDayDelta(
            rollup.finishDate,
            rollup.baselineFinish,
          ),
          durationVarianceDays:
            rollup.durationDays != null && rollup.baselineDurationDays != null
              ? Math.round(
                (Number(rollup.durationDays) -
                  Number(rollup.baselineDurationDays)) *
                10,
              ) / 10
              : undefined,
          percentComplete: rollup.percentComplete,
          priority: 500,
          notes: phase.description ?? undefined,
        });
      }
    }

    const unphasedParentId = 'phase:__unphased__';
    const hasUnphased =
      topLevel.some((t) => !t.phaseId) ||
      milestones.some((m) => !m.phaseId && isStandaloneMilestone(m));
    if (hasUnphased) {
      const unphasedTasks = workTasks.filter((t) => !t.phaseId);
      const rollup = this.rollupSchedule(
        unphasedTasks,
        {
          startDate: project.startDate,
          endDate: project.endDate,
        },
        tz,
      );
      exportTasks.push({
        id: unphasedParentId,
        name: 'Unphased',
        parentId: projectExportId,
        summary: true,
        outlineLevel: 2,
        startDate: rollup.startDate,
        finishDate: rollup.finishDate,
        baselineStart: rollup.baselineStart,
        baselineFinish: rollup.baselineFinish,
        durationDays: rollup.durationDays,
        baselineDurationDays: rollup.baselineDurationDays,
        startVarianceDays: this.signedDayDelta(
          rollup.startDate,
          rollup.baselineStart,
        ),
        finishVarianceDays: this.signedDayDelta(
          rollup.finishDate,
          rollup.baselineFinish,
        ),
        durationVarianceDays:
          rollup.durationDays != null && rollup.baselineDurationDays != null
            ? Math.round(
              (Number(rollup.durationDays) -
                Number(rollup.baselineDurationDays)) *
              10,
            ) / 10
            : undefined,
        percentComplete: rollup.percentComplete,
        priority: 500,
      });
    }

    const childrenByParent = new Map<string, TaskRow[]>();
    for (const task of workTasks) {
      if (!task.parentTaskId || twinIds.has(task.parentTaskId)) continue;
      const list = childrenByParent.get(task.parentTaskId) ?? [];
      list.push(task);
      childrenByParent.set(task.parentTaskId, list);
    }

    const pushTaskTree = (
      task: TaskRow,
      parentId: string,
      outlineLevel: number,
    ) => {
      if (task.isPhaseScheduleTask) return;
      const start = toMspdiDateTime(task.startDate, false, tz);
      const finish = toMspdiDateTime(task.endDate, true, tz);
      // Export only stored baselines (same rule as import — do not copy current→baseline).
      const baselineStart = toMspdiDateTime(task.baselineStart, false, tz);
      const baselineFinish = toMspdiDateTime(task.baselineEnd, true, tz);
      // Prefer stored working-day duration (import fidelity); calendar only as fallback.
      const durationDays =
        this.decimalToNumber(task.durationDays) ??
        this.inclusiveDays(task.startDate, task.endDate);
      const workHours = this.decimalToNumber(task.effortHours);

      const isMilestone = Boolean(task.isScheduleMilestone);
      const storedDuration = this.decimalToNumber(task.durationDays);
      const explicitDurationDays =
        storedDuration != null
          ? storedDuration
          : isMilestone
            ? 0
            : this.inclusiveDays(task.startDate, task.endDate);
      const resolvedDurationDays = isMilestone
        ? storedDuration != null && storedDuration > 0
          ? storedDuration
          : 0
        : explicitDurationDays;
      const isZeroMilestone = isMilestone && resolvedDurationDays === 0;

      const storedBaselineDuration = this.decimalToNumber(
        task.baselineDurationDays,
      );
      const baselineDurationDays = isMilestone
        ? storedBaselineDuration != null && storedBaselineDuration > 0
          ? storedBaselineDuration
          : 0
        : storedBaselineDuration ??
        this.inclusiveDays(task.baselineStart, task.baselineEnd);

      exportTasks.push({
        id: task.id,
        name: task.title,
        parentId,
        summary: (childrenByParent.get(task.id) ?? []).length > 0,
        outlineLevel,
        milestone: isMilestone || undefined,
        startDate: start,
        finishDate: isZeroMilestone ? start : finish,
        baselineStart,
        baselineFinish: isZeroMilestone
          ? baselineStart || baselineFinish
          : baselineFinish,
        durationDays: resolvedDurationDays,
        workHours: isZeroMilestone ? 0 : workHours,
        baselineDurationDays,
        startVarianceDays: this.signedDayDelta(start, baselineStart),
        finishVarianceDays: this.signedDayDelta(finish, baselineFinish),
        durationVarianceDays:
          resolvedDurationDays != null && baselineDurationDays != null
            ? Math.round(
              (Number(resolvedDurationDays) - Number(baselineDurationDays)) *
              10,
            ) / 10
            : undefined,
        percentComplete: (() => {
          const lower = String(task.status || '').toLowerCase().trim();
          if (lower === 'done' || lower === 'approved' || lower === 'completed') return 100;
          if (lower === 'to_do' || lower === 'to do') return 0;
          if (typeof task.progressApproved === 'number') {
            return Math.max(0, Math.min(100, Math.round(task.progressApproved)));
          }
          if (lower === 'in_progress' || lower === 'in progress') return 50;
          return 0;
        })(),
        priority: this.mapPriority(task.priority),
        notes: task.description ?? undefined,
        resourceNames: this.mergedResourceNames(task, projectOrganization),
        customFields: this.toCustomFieldsPayload(
          task.mspCustomFields,
          customFieldDefs,
        ),
        ...this.mspScheduleMeta(task, tz),
      });

      for (const child of childrenByParent.get(task.id) ?? []) {
        pushTaskTree(child, task.id, outlineLevel + 1);
      }
    };

    for (const phase of project.phases) {
      const phaseExportId = phaseIdByExportId.get(phase.id)!;
      const phaseTasks = topLevel.filter((t) => t.phaseId === phase.id);
      for (const task of phaseTasks) {
        pushTaskTree(task, phaseExportId, 3);
      }
      const phaseMilestones = milestones.filter(
        (m) => m.phaseId === phase.id && isStandaloneMilestone(m),
      );
      for (const ms of phaseMilestones) {
        const start = toMspdiDateTime(ms.targetDate, false, tz);
        exportTasks.push({
          id: `milestone:${ms.id}`,
          name: ms.title,
          parentId: phaseExportId,
          summary: false,
          milestone: true,
          outlineLevel: 3,
          startDate: start,
          finishDate: start,
          durationDays: 0,
          baselineDurationDays: 0,
          percentComplete: ['completed', 'done', 'approved'].includes(
            String(ms.status || '').toLowerCase().trim(),
          )
            ? 100
            : 0,
          priority: 500,
        });
      }
    }

    if (hasUnphased) {
      for (const task of topLevel.filter((t) => !t.phaseId)) {
        pushTaskTree(task, unphasedParentId, 3);
      }
      for (const ms of milestones.filter(
        (m) => !m.phaseId && isStandaloneMilestone(m),
      )) {
        const start = toMspdiDateTime(ms.targetDate, false, tz);
        exportTasks.push({
          id: `milestone:${ms.id}`,
          name: ms.title,
          parentId: unphasedParentId,
          summary: false,
          milestone: true,
          outlineLevel: 3,
          startDate: start,
          finishDate: start,
          durationDays: 0,
          baselineDurationDays: 0,
          percentComplete: ['completed', 'done', 'approved'].includes(
            String(ms.status || '').toLowerCase().trim(),
          )
            ? 100
            : 0,
          priority: 500,
        });
      }
    }

    const rawDepPayload: MspdiExportDependencyPayload[] = dependencies.map(
      (dep) => ({
        predecessorId: dep.predecessorId,
        successorId: dep.successorId,
        type: dep.depType || 'FS',
        lagDays: dep.lagDays ?? 0,
      }),
    );
    const { dependencies: depPayload, warnings: cycleWarnings } =
      filterMspdiCycleDependencies(exportTasks, rawDepPayload);
    for (const warning of cycleWarnings) {
      this.logger.warn(warning);
    }

    const taskDays = exportTasks
      .flatMap((t) => [t.startDate, t.finishDate])
      .filter((v): v is string => Boolean(v))
      .sort();

    const rangeStart =
      toMspdiDateTime(project.startDate, false, tz) ||
      taskDays[0] ||
      undefined;
    const rangeFinish =
      toMspdiDateTime(project.endDate, true, tz) ||
      taskDays[taskDays.length - 1] ||
      undefined;

    const holidays = await this.loadHolidays(
      this.toDay(rangeStart),
      this.toDay(rangeFinish),
    );

    const durationDays = this.decimalToNumber(project.durationDays);
    const baselineDurationDays = this.decimalToNumber(
      project.baselineDurationDays,
    );
    const durationVarianceDays =
      this.decimalToNumber(project.durationVarianceDays) ??
      (durationDays != null && baselineDurationDays != null
        ? Math.round((durationDays - baselineDurationDays) * 10) / 10
        : undefined);
    const percentComplete =
      project.percentComplete != null &&
        Number.isFinite(Number(project.percentComplete))
        ? Math.max(0, Math.min(100, Math.round(Number(project.percentComplete))))
        : this.averageProgress(tasks);

    const { resources, assignments } = this.buildResourcesAndAssignments(
      tasks,
      projectOrganization,
    );

    return {
      project: {
        name: project.name,
        startDate: rangeStart,
        finishDate: rangeFinish,
        baselineStart: toMspdiDateTime(project.baselineStartDate, false, tz) || undefined,
        baselineFinish: toMspdiDateTime(project.baselineEndDate, true, tz) || undefined,
        durationDays: durationDays ?? undefined,
        baselineDurationDays: baselineDurationDays ?? undefined,
        percentComplete,
        durationVarianceDays,
      },
      tasks: exportTasks,
      dependencies: depPayload,
      holidays,
      resources,
      assignments,
      customFieldDefs: mergeCustomFieldDefsForExport(
        customFieldDefs,
        exportTasks,
      ),
    };
  }

  private mspScheduleMeta(
    task: {
      mspTaskMode?: string | null;
      mspConstraintType?: string | null;
      mspConstraintDate?: Date | null;
    },
    timeZone: string,
  ): Pick<
    MspdiExportTaskPayload,
    'taskMode' | 'constraintType' | 'constraintDate'
  > {
    const type = (task.mspConstraintType || 'ASAP').trim().toUpperCase();
    const needsDate = type !== 'ASAP' && type !== 'ALAP';
    return {
      taskMode:
        task.mspTaskMode?.trim().toLowerCase() === 'auto' ? 'Auto' : 'Manual',
      constraintType: type || 'ASAP',
      constraintDate:
        needsDate && task.mspConstraintDate
          ? toMspdiDateTime(task.mspConstraintDate, false, timeZone) ||
          undefined
          : undefined,
    };
  }

  private toCustomFieldsPayload(
    raw: unknown,
    defs?: MspdiExportCustomFieldDef[],
  ): { fieldName: string; value: string }[] | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const aliasToSlot = new Map(
      (defs ?? [])
        .filter((d) => d.alias?.trim() && d.fieldName?.trim())
        .map((d) => [
          d.alias!.trim().toLowerCase(),
          d.fieldName.trim(),
        ]),
    );
    const out: { fieldName: string; value: string }[] = [];
    for (const [fieldName, value] of Object.entries(
      raw as Record<string, unknown>,
    )) {
      if (!fieldName?.trim()) continue;
      const text =
        value == null
          ? ''
          : typeof value === 'string'
            ? value.trim()
            : String(value).trim();
      if (!text) continue;
      const key = fieldName.trim();
      const slot =
        aliasToSlot.get(key.toLowerCase()) ||
        key;
      out.push({ fieldName: slot, value: text });
    }
    return out.length > 0 ? out : undefined;
  }

  private toCustomFieldDefsPayload(raw: unknown):
    | {
      fieldName: string;
      index?: number;
      type?: string;
      alias?: string;
      fieldId?: string;
    }[]
    | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const out: {
      fieldName: string;
      index?: number;
      type?: string;
      alias?: string;
      fieldId?: string;
    }[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const fieldName =
        typeof row.fieldName === 'string' ? row.fieldName.trim() : '';
      if (!fieldName) continue;
      out.push({
        fieldName,
        index:
          typeof row.index === 'number' && Number.isFinite(row.index)
            ? row.index
            : undefined,
        type: typeof row.type === 'string' ? row.type : undefined,
        alias: typeof row.alias === 'string' ? row.alias.trim() : undefined,
        fieldId: typeof row.fieldId === 'string' ? row.fieldId.trim() : undefined,
      });
    }
    return out.length > 0 ? out : undefined;
  }

  /**
   * Build MSP Resources + Assignments from Owner / Backup plus unmatched
   * names stored on the task (e.g. NES Customer).
   */
  private buildResourcesAndAssignments(
    tasks: TaskRow[],
    projectOrganization: string,
  ): {
    resources: MspdiExportResourcePayload[];
    assignments: MspdiExportAssignmentPayload[];
  } {
    const resourcesByKey = new Map<string, MspdiExportResourcePayload>();
    const assignments: MspdiExportAssignmentPayload[] = [];
    const seenAssignment = new Set<string>();

    const ensureResource = (
      key: string,
      name: string,
      email?: string | null,
    ): string => {
      if (resourcesByKey.has(key)) return key;
      resourcesByKey.set(key, {
        id: key,
        name,
        email: email ?? undefined,
      });
      return key;
    };

    const assign = (taskId: string, resourceKey: string) => {
      const key = `${taskId}:${resourceKey}`;
      if (seenAssignment.has(key)) return;
      seenAssignment.add(key);
      assignments.push({ taskId, resourceId: resourceKey, units: 1 });
    };

    for (const task of tasks) {
      for (const person of [task.owner, task.backupOwner]) {
        if (!person?.id || !person.displayName?.trim()) continue;
        const org = this.resolvePersonOrganization(person, projectOrganization);
        const name = this.formatResourceName(person.displayName, org);
        assign(
          task.id,
          ensureResource(`user:${person.id}`, name, person.email),
        );
      }

      const extras = extraResourceNames(task.resourceNames, [
        task.owner?.displayName,
        task.backupOwner?.displayName,
      ]);
      for (const extraName of extras) {
        const key = `name:${extraName.toLowerCase()}`;
        assign(task.id, ensureResource(key, extraName));
      }
    }

    return {
      resources: [...resourcesByKey.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      assignments,
    };
  }

  private mergedResourceNames(
    task: TaskRow,
    projectOrganization: string,
  ): string | undefined {
    const owner = task.owner?.displayName?.trim()
      ? this.formatResourceName(
        task.owner.displayName,
        this.resolvePersonOrganization(task.owner, projectOrganization),
      )
      : '';
    const backup = task.backupOwner?.displayName?.trim()
      ? this.formatResourceName(
        task.backupOwner.displayName,
        this.resolvePersonOrganization(task.backupOwner, projectOrganization),
      )
      : '';
    const merged = mergeExportResourceNames(owner, backup, task.resourceNames);
    return merged || undefined;
  }

  private formatResourceName(name: string, organization?: string): string {
    const n = name.trim();
    if (!n) return '';
    if (/\([^)]+\)\s*$/.test(n)) return n;
    const org = String(organization || '').trim();
    if (!org) return n;
    return `${n} (${org})`;
  }

  private resolvePersonOrganization(
    person: PersonRow,
    projectOrganization: string,
  ): string {
    const dept = person.employees?.department?.name?.trim() || '';
    if (person.isExternal && projectOrganization.trim()) {
      return projectOrganization.trim();
    }
    if (dept) return dept;
    return projectOrganization.trim();
  }

  /** Roll phase / summary schedule from member tasks (prefer stored fields). */
  private rollupSchedule(
    members: TaskRow[],
    fallback: { startDate?: Date | null; endDate?: Date | null },
    timeZone: string,
  ): {
    startDate?: string;
    finishDate?: string;
    baselineStart?: string;
    baselineFinish?: string;
    durationDays?: number;
    baselineDurationDays?: number;
    percentComplete: number;
  } {
    const starts = members
      .map((t) => toMspdiDateTime(t.startDate, false, timeZone))
      .filter((v): v is string => Boolean(v))
      .sort();
    const finishes = members
      .map((t) => toMspdiDateTime(t.endDate, true, timeZone))
      .filter((v): v is string => Boolean(v))
      .sort();
    const baselineStarts = members
      .map((t) => toMspdiDateTime(t.baselineStart, false, timeZone))
      .filter((v): v is string => Boolean(v))
      .sort();
    const baselineFinishes = members
      .map((t) => toMspdiDateTime(t.baselineEnd, true, timeZone))
      .filter((v): v is string => Boolean(v))
      .sort();

    const startDate =
      starts[0] || toMspdiDateTime(fallback.startDate, false, timeZone) || undefined;
    const finishDate =
      finishes[finishes.length - 1] ||
      toMspdiDateTime(fallback.endDate, true, timeZone) ||
      undefined;
    const baselineStart = baselineStarts[0];
    const baselineFinish = baselineFinishes[baselineFinishes.length - 1];

    // Phase/summary span ≈ Mon–Fri working days (not inclusive calendar).
    const durationDays =
      this.workingDaysMonFri(startDate, finishDate) ??
      this.inclusiveDays(startDate, finishDate);
    const baselineDurationDays =
      this.workingDaysMonFri(baselineStart, baselineFinish) ??
      this.inclusiveDays(baselineStart, baselineFinish);

    return {
      startDate,
      finishDate,
      baselineStart,
      baselineFinish,
      durationDays,
      baselineDurationDays,
      percentComplete: this.averageProgress(members),
    };
  }

  /** Count Mon–Fri days inclusive (approx. MSP Standard calendar without holidays). */
  private workingDaysMonFri(
    start?: string | null,
    end?: string | null,
  ): number | undefined {
    if (!start || !end) return undefined;
    const s = Date.parse(`${String(start).slice(0, 10)}T12:00:00Z`);
    const e = Date.parse(`${String(end).slice(0, 10)}T12:00:00Z`);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return undefined;
    let count = 0;
    for (let t = s; t <= e; t += 86_400_000) {
      const day = new Date(t).getUTCDay();
      if (day !== 0 && day !== 6) count += 1;
    }
    return Math.max(1, count);
  }

  private averageProgress(
    members: { progressApproved?: number | null; status?: string | null }[],
  ): number {
    if (members.length === 0) return 0;
    const sum = members.reduce((acc, t) => {
      const lower = String(t.status || '').toLowerCase().trim();
      if (lower === 'done' || lower === 'approved' || lower === 'completed') {
        return acc + 100;
      }
      if (lower === 'to_do' || lower === 'to do') {
        return acc;
      }
      if (typeof t.progressApproved === 'number') {
        return acc + Math.max(0, Math.min(100, Math.round(t.progressApproved)));
      }
      if (lower === 'in_progress' || lower === 'in progress') {
        return acc + 50;
      }
      return acc;
    }, 0);
    return Math.round(sum / members.length);
  }

  private async loadHolidays(
    from?: string,
    to?: string,
  ): Promise<MspdiExportHolidayPayload[]> {
    if (!from && !to) {
      return [];
    }

    const where: {
      holidayDate?: { gte?: Date; lte?: Date };
    } = {};
    if (from || to) {
      where.holidayDate = {};
      if (from) where.holidayDate.gte = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`);
      if (to) where.holidayDate.lte = new Date(`${String(to).slice(0, 10)}T00:00:00.000Z`);
    }

    const rows = await this.prisma.holiday.findMany({
      where,
      orderBy: { holidayDate: 'asc' },
      select: { holidayDate: true, name: true },
      take: 500,
    });

    return rows.map((row) => ({
      date: this.toDay(row.holidayDate)!,
      name: row.name,
    }));
  }

  private toDay(value?: Date | string | null): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  private inclusiveDays(
    start?: Date | string | null,
    end?: Date | string | null,
  ): number | undefined {
    const s = this.toDay(start);
    const e = this.toDay(end);
    if (!s || !e) return undefined;
    const startMs = Date.parse(`${s}T00:00:00.000Z`);
    const endMs = Date.parse(`${e}T00:00:00.000Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
    return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
  }

  private signedDayDelta(
    actual?: string,
    baseline?: string,
  ): number | undefined {
    if (!actual || !baseline) return undefined;
    const a = Date.parse(`${this.toDay(actual)}T00:00:00.000Z`);
    const b = Date.parse(`${this.toDay(baseline)}T00:00:00.000Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    return Math.round((a - b) / 86_400_000);
  }

  private decimalToNumber(value: unknown): number | undefined {
    if (value == null) return undefined;
    const n = Number(value);
    // Keep 0-day durations for MSP variance parity.
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 10) / 10;
  }

  private mapPriority(priority: string): number {
    switch (priority) {
      case 'Critical':
        return 1000;
      case 'High':
        return 700;
      case 'Low':
        return 300;
      default:
        return 500;
    }
  }
}
