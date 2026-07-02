import { Injectable } from '@nestjs/common';
import {
  PhaseStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  MppImportPreview,
  MppImportResultSummary,
  ParsedMppProject,
  ParsedMppTask,
} from './mpp-import.types';

const PREVIEW_TASK_LIMIT = 250;

@Injectable()
export class MppImportMapper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute a non-destructive preview of what an import would create.
   * Performs read-only resource matching against existing users but never writes.
   */
  async buildPreview(parsed: ParsedMppProject): Promise<MppImportPreview> {
    const allTasks = parsed.tasks ?? [];
    const importableTasks = allTasks.filter(
      (task) => !task.summary && task.name?.trim(),
    );
    const skippedSummaryTasks = allTasks.filter((task) => task.summary).length;
    const importableUids = new Set(importableTasks.map((task) => task.uid));

    let dependencies = 0;
    for (const task of importableTasks) {
      for (const predecessor of task.predecessors ?? []) {
        if (importableUids.has(predecessor.predecessorUid)) {
          dependencies += 1;
        }
      }
    }

    const resourceMatch = await this.countResourceMatches(parsed);

    const tasks = importableTasks.slice(0, PREVIEW_TASK_LIMIT).map((task) => ({
      uid: task.uid,
      name: task.name,
      startDate: task.startDate,
      finishDate: task.finishDate,
      durationDays: task.durationDays,
      percentComplete: task.percentComplete,
      hasParent: Boolean(task.parentUid && importableUids.has(task.parentUid)),
      predecessorCount: (task.predecessors ?? []).filter((predecessor) =>
        importableUids.has(predecessor.predecessorUid),
      ).length,
    }));

    const warnings = [...(parsed.warnings ?? []), ...resourceMatch.warnings];
    if (importableTasks.length > PREVIEW_TASK_LIMIT) {
      warnings.push(
        `Showing the first ${PREVIEW_TASK_LIMIT} of ${importableTasks.length} tasks. All tasks will be imported on save.`,
      );
    }
    if (importableTasks.length === 0) {
      warnings.push('No importable tasks were found in this file.');
    }

    return {
      projectName: parsed.project?.name,
      startDate: parsed.project?.startDate,
      finishDate: parsed.project?.finishDate,
      counts: {
        importableTasks: importableTasks.length,
        skippedSummaryTasks,
        dependencies,
        resourcesMatched: resourceMatch.matched,
        resourcesUnmatched: resourceMatch.unmatched,
      },
      tasks,
      warnings,
    };
  }

  async persistParsedProject(
    projectId: string,
    parsed: ParsedMppProject,
  ): Promise<MppImportResultSummary> {
    const warnings = [...(parsed.warnings ?? [])];
    const importableTasks = (parsed.tasks ?? []).filter(
      (task) => !task.summary && task.name?.trim(),
    );

    if (importableTasks.length === 0) {
      throw new Error('No importable tasks found in the project file');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        phases: {
          orderBy: { orderIndex: 'asc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw new Error('Target project not found');
    }

    const phaseId = await this.resolvePhaseId(project, parsed, warnings);
    const uidToTaskId = new Map<number, string>();
    let tasksCreated = 0;
    let dependenciesCreated = 0;
    const allTasks = parsed.tasks ?? [];

    await this.prisma.$transaction(async (tx) => {
      const pendingParents = [...importableTasks];

      while (pendingParents.length > 0) {
        const batch = pendingParents.filter((task) =>
          this.isTaskReadyToCreate(task, uidToTaskId, allTasks),
        );

        if (batch.length === 0) {
          throw new Error('Unable to resolve task hierarchy from MPP file');
        }

        for (const task of batch) {
          const parentTaskId =
            task.parentUid && uidToTaskId.has(task.parentUid)
              ? uidToTaskId.get(task.parentUid)
              : undefined;

          if (task.parentUid && !parentTaskId) {
            warnings.push(
              `Task "${task.name}" imported without parent because the parent is a summary row in MS Project.`,
            );
          }

          const created = await tx.task.create({
            data: this.toTaskCreateInput(projectId, phaseId, task, parentTaskId),
          });
          uidToTaskId.set(task.uid, created.id);
          tasksCreated += 1;
        }

        for (const task of batch) {
          const index = pendingParents.findIndex((item) => item.uid === task.uid);
          if (index >= 0) {
            pendingParents.splice(index, 1);
          }
        }
      }

      for (const task of importableTasks) {
        const successorId = uidToTaskId.get(task.uid);
        if (!successorId) {
          continue;
        }

        for (const predecessor of task.predecessors ?? []) {
          const predecessorId = uidToTaskId.get(predecessor.predecessorUid);
          if (!predecessorId) {
            warnings.push(
              `Skipped dependency: predecessor UID ${predecessor.predecessorUid} not found for task "${task.name}"`,
            );
            continue;
          }

          await tx.taskDependency.create({
            data: {
              predecessorId,
              successorId,
              depType: predecessor.type || 'FS',
              lagDays: predecessor.lagDays ?? 0,
            },
          });
          dependenciesCreated += 1;
        }
      }
    });

    const resourceMatch = await this.countResourceMatches(parsed);

    return {
      tasksCreated,
      dependenciesCreated,
      resourcesMatched: resourceMatch.matched,
      assignmentsSkipped: (parsed.assignments ?? []).length,
      warnings: [
        ...warnings,
        ...resourceMatch.warnings,
        'Resource assignments are not imported yet; mapping UI will be added later.',
      ],
    };
  }

  private async resolvePhaseId(
    project: {
      id: string;
      startDate: Date;
      endDate: Date;
      phases: { id: string }[];
    },
    parsed: ParsedMppProject,
    warnings: string[],
  ): Promise<string> {
    if (project.phases[0]?.id) {
      return project.phases[0].id;
    }

    const startDate = this.parseDate(parsed.project?.startDate) ?? project.startDate;
    const endDate = this.parseDate(parsed.project?.finishDate) ?? project.endDate;

    const phase = await this.prisma.projectPhase.create({
      data: {
        projectId: project.id,
        name: 'Imported Schedule',
        orderIndex: 0,
        startDate,
        endDate,
        status: PhaseStatus.Planned,
      },
    });

    warnings.push('Created default phase "Imported Schedule" for imported tasks.');
    return phase.id;
  }

  private toTaskCreateInput(
    projectId: string,
    phaseId: string,
    task: ParsedMppTask,
    parentTaskId?: string,
  ): Prisma.TaskCreateInput {
    const progress = Math.max(0, Math.min(100, task.percentComplete ?? 0));
    const status =
      progress >= 100
        ? TaskStatus.Done
        : progress > 0
          ? TaskStatus.In_Progress
          : TaskStatus.To_Do;

    return {
      project: { connect: { id: projectId } },
      phase: { connect: { id: phaseId } },
      parentTask: parentTaskId ? { connect: { id: parentTaskId } } : undefined,
      title: task.name.slice(0, 255),
      description: task.wbs ? `WBS: ${task.wbs}` : undefined,
      startDate: this.parseDate(task.startDate),
      endDate: this.parseDate(task.finishDate),
      baselineStart: this.parseDate(task.startDate),
      baselineEnd: this.parseDate(task.finishDate),
      effortHours: task.durationDays ? task.durationDays * 8 : undefined,
      progressApproved: progress,
      status,
    };
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private isTaskReadyToCreate(
    task: ParsedMppTask,
    uidToTaskId: Map<number, string>,
    allTasks: ParsedMppTask[],
  ): boolean {
    if (!task.parentUid) {
      return true;
    }

    if (uidToTaskId.has(task.parentUid)) {
      return true;
    }

    const parent = allTasks.find((item) => item.uid === task.parentUid);
    return !parent || parent.summary;
  }

  private async countResourceMatches(parsed: ParsedMppProject): Promise<{
    matched: number;
    unmatched: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const resource of parsed.resources ?? []) {
      const email = resource.email?.trim().toLowerCase();
      const name = resource.name?.trim();

      if (!email && !name) {
        continue;
      }

      const user = await this.prisma.user.findFirst({
        where: email
          ? { email }
          : {
              displayName: {
                equals: name,
                mode: 'insensitive',
              },
            },
        select: { id: true },
      });

      if (user) {
        matched += 1;
      } else {
        unmatched += 1;
        warnings.push(`Unmapped resource: ${name ?? email}`);
      }
    }

    return { matched, unmatched, warnings };
  }
}
