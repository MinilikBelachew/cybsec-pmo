import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  MspdiExportAssignmentPayload,
  MspdiExportDependencyPayload,
  MspdiExportHolidayPayload,
  MspdiExportRequestPayload,
  MspdiExportResourcePayload,
  MspdiExportTaskPayload,
} from './mspdi-export.types';
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
  priority: string;
  createdAt: Date;
  ownerId: string | null;
  backupOwnerId: string | null;
  owner: PersonRow | null;
  backupOwner: PersonRow | null;
  resourceNames: string | null;
  isScheduleMilestone: boolean;
};

@Injectable()
export class MspdiExportBuilder {
  constructor(private readonly prisma: PrismaService) {}

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
        priority: true,
        createdAt: true,
        ownerId: true,
        backupOwnerId: true,
        resourceNames: true,
        owner: { select: personSelect },
        backupOwner: { select: personSelect },
        scheduleMilestone: { select: { id: true } },
      },
    });
    const tasks: TaskRow[] = loadedTasks.map((task) => ({
      ...task,
      isScheduleMilestone: Boolean(task.scheduleMilestone),
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

    const childrenByParent = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      if (!task.parentTaskId) continue;
      const list = childrenByParent.get(task.parentTaskId) ?? [];
      list.push(task);
      childrenByParent.set(task.parentTaskId, list);
    }

    const topLevel = tasks.filter((t) => !t.parentTaskId);

    for (const phase of project.phases) {
      const phaseExportId = `phase:${phase.id}`;
      phaseIdByExportId.set(phase.id, phaseExportId);
      const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
      const rollup = this.rollupSchedule(
        phaseTasks,
        {
          startDate: phase.startDate,
          endDate: phase.endDate,
        },
        tz,
      );

      exportTasks.push({
        id: phaseExportId,
        name: phase.name,
        summary: true,
        outlineLevel: 1,
        startDate: rollup.startDate,
        finishDate: rollup.finishDate,
        // Only real baselines from child tasks — never invent from current dates.
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
        percentComplete: rollup.percentComplete,
        priority: 500,
        notes: phase.description ?? undefined,
      });
    }

    const unphasedParentId = 'phase:__unphased__';
    const hasUnphased =
      topLevel.some((t) => !t.phaseId) ||
      milestones.some((m) => !m.phaseId && isStandaloneMilestone(m));
    if (hasUnphased) {
      const unphasedTasks = tasks.filter((t) => !t.phaseId);
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
        name: 'Imported Schedule',
        summary: true,
        outlineLevel: 1,
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
        percentComplete: rollup.percentComplete,
        priority: 500,
      });
    }

    const pushTaskTree = (
      task: TaskRow,
      parentId: string,
      outlineLevel: number,
    ) => {
      const start = toMspdiDateTime(task.startDate, false, tz);
      const finish = toMspdiDateTime(task.endDate, true, tz);
      // Export only stored baselines (same rule as import — do not copy current→baseline).
      const baselineStart = toMspdiDateTime(task.baselineStart, false, tz);
      const baselineFinish = toMspdiDateTime(task.baselineEnd, true, tz);
      const durationDays = this.inclusiveDays(task.startDate, task.endDate);
      const workHours = this.decimalToNumber(task.effortHours);
      const baselineDurationDays =
        this.decimalToNumber(task.baselineDurationDays) ??
        this.inclusiveDays(task.baselineStart, task.baselineEnd);

      exportTasks.push({
        id: task.id,
        name: task.title,
        parentId,
        summary: (childrenByParent.get(task.id) ?? []).length > 0,
        outlineLevel,
        milestone: task.isScheduleMilestone || undefined,
        startDate: start,
        finishDate: finish,
        baselineStart,
        baselineFinish,
        durationDays: task.isScheduleMilestone ? 0 : durationDays,
        workHours: task.isScheduleMilestone ? 0 : workHours,
        baselineDurationDays,
        startVarianceDays: this.signedDayDelta(start, baselineStart),
        finishVarianceDays: this.signedDayDelta(finish, baselineFinish),
        percentComplete: Math.max(0, Math.min(100, task.progressApproved ?? 0)),
        priority: this.mapPriority(task.priority),
        notes: task.description ?? undefined,
        resourceNames: this.mergedResourceNames(task, projectOrganization),
      });

      for (const child of childrenByParent.get(task.id) ?? []) {
        pushTaskTree(child, task.id, outlineLevel + 1);
      }
    };

    for (const phase of project.phases) {
      const phaseExportId = phaseIdByExportId.get(phase.id)!;
      const phaseTasks = topLevel.filter((t) => t.phaseId === phase.id);
      for (const task of phaseTasks) {
        pushTaskTree(task, phaseExportId, 2);
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
          outlineLevel: 2,
          startDate: start,
          finishDate: toMspdiDateTime(ms.targetDate, true, tz),
          percentComplete:
            String(ms.status).toLowerCase() === 'completed' ? 100 : 0,
          priority: 500,
        });
      }
    }

    if (hasUnphased) {
      for (const task of topLevel.filter((t) => !t.phaseId)) {
        pushTaskTree(task, unphasedParentId, 2);
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
          outlineLevel: 2,
          startDate: start,
          finishDate: toMspdiDateTime(ms.targetDate, true, tz),
          percentComplete:
            String(ms.status).toLowerCase() === 'completed' ? 100 : 0,
          priority: 500,
        });
      }
    }

    const depPayload: MspdiExportDependencyPayload[] = dependencies.map(
      (dep) => ({
        predecessorId: dep.predecessorId,
        successorId: dep.successorId,
        type: dep.depType || 'FS',
        lagDays: dep.lagDays ?? 0,
      }),
    );

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
    };
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

    const durationDays = this.inclusiveDays(startDate, finishDate);
    const baselineDurationDays = this.inclusiveDays(
      baselineStart,
      baselineFinish,
    );

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

  private averageProgress(members: { progressApproved?: number | null }[]): number {
    if (members.length === 0) return 0;
    const sum = members.reduce(
      (acc, t) => acc + Math.max(0, Math.min(100, t.progressApproved ?? 0)),
      0,
    );
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
    if (!Number.isFinite(n) || n <= 0) return undefined;
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
