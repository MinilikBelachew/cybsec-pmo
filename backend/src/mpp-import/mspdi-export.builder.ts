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
};

@Injectable()
export class MspdiExportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load project schedule and map to the payload expected by mpxj-service /export/mspdi.
   * Phases become summary rows; leaf tasks keep plan order (createdAt desc = import plan order).
   */
  async buildPayload(projectId: string): Promise<MspdiExportRequestPayload> {
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

    const tasks = await this.prisma.task.findMany({
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
        owner: { select: personSelect },
        backupOwner: { select: personSelect },
      },
    });

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
      const rollup = this.rollupSchedule(phaseTasks, {
        startDate: phase.startDate,
        endDate: phase.endDate,
      });

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
    const hasUnphased = topLevel.some((t) => !t.phaseId);
    if (hasUnphased) {
      const unphasedTasks = tasks.filter((t) => !t.phaseId);
      const rollup = this.rollupSchedule(unphasedTasks, {
        startDate: project.startDate,
        endDate: project.endDate,
      });
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
      const start = this.toDay(task.startDate);
      const finish = this.toDay(task.endDate);
      // Export only stored baselines (same rule as import — do not copy current→baseline).
      const baselineStart = this.toDay(task.baselineStart);
      const baselineFinish = this.toDay(task.baselineEnd);
      const durationDays =
        this.decimalToNumber(task.durationDays) ??
        this.toDurationDays(task.effortHours, task.startDate, task.endDate);
      const baselineDurationDays =
        this.decimalToNumber(task.baselineDurationDays) ??
        this.inclusiveDays(task.baselineStart, task.baselineEnd);

      exportTasks.push({
        id: task.id,
        name: task.title,
        parentId,
        summary: (childrenByParent.get(task.id) ?? []).length > 0,
        outlineLevel,
        startDate: start,
        finishDate: finish,
        baselineStart,
        baselineFinish,
        durationDays,
        baselineDurationDays,
        startVarianceDays: this.signedDayDelta(start, baselineStart),
        finishVarianceDays: this.signedDayDelta(finish, baselineFinish),
        percentComplete: Math.max(0, Math.min(100, task.progressApproved ?? 0)),
        priority: this.mapPriority(task.priority),
        notes: task.description ?? undefined,
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
    }

    if (hasUnphased) {
      for (const task of topLevel.filter((t) => !t.phaseId)) {
        pushTaskTree(task, unphasedParentId, 2);
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
      this.toDay(project.startDate) ?? taskDays[0] ?? undefined;
    const rangeFinish =
      this.toDay(project.endDate) ??
      taskDays[taskDays.length - 1] ??
      undefined;

    const holidays = await this.loadHolidays(rangeStart, rangeFinish);

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

    const projectOrganization =
      project.customer?.displayName ||
      project.customer?.companyName ||
      project.department?.name ||
      '';

    const { resources, assignments } = this.buildResourcesAndAssignments(
      tasks,
      projectOrganization,
    );

    return {
      project: {
        name: project.name,
        startDate: rangeStart,
        finishDate: rangeFinish,
        baselineStart: this.toDay(project.baselineStartDate),
        baselineFinish: this.toDay(project.baselineEndDate),
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
   * Build MSP Resources + Assignments from matched Cybsec owners only
   * (owner / backupOwner). Unmatched MPP names are not stored or exported.
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
    }

    return {
      resources: [...resourcesByKey.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      assignments,
    };
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
      .map((t) => this.toDay(t.startDate))
      .filter((v): v is string => Boolean(v))
      .sort();
    const finishes = members
      .map((t) => this.toDay(t.endDate))
      .filter((v): v is string => Boolean(v))
      .sort();
    const baselineStarts = members
      .map((t) => this.toDay(t.baselineStart))
      .filter((v): v is string => Boolean(v))
      .sort();
    const baselineFinishes = members
      .map((t) => this.toDay(t.baselineEnd))
      .filter((v): v is string => Boolean(v))
      .sort();

    const startDate = starts[0] ?? this.toDay(fallback.startDate);
    const finishDate =
      finishes[finishes.length - 1] ?? this.toDay(fallback.endDate);
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
      if (from) where.holidayDate.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.holidayDate.lte = new Date(`${to}T00:00:00.000Z`);
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
    const a = Date.parse(`${actual}T00:00:00.000Z`);
    const b = Date.parse(`${baseline}T00:00:00.000Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    return Math.round((a - b) / 86_400_000);
  }

  private toDurationDays(
    effortHours?: number | null,
    start?: Date | null,
    end?: Date | null,
  ): number | undefined {
    if (effortHours != null && Number.isFinite(effortHours) && effortHours > 0) {
      return Math.round((effortHours / 8) * 10) / 10;
    }
    return this.inclusiveDays(start, end);
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
