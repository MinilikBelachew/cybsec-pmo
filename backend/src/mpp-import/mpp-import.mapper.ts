import { Injectable } from '@nestjs/common';
import {
  PhaseStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  MppImportPreview,
  MppImportPreviewProject,
  MppImportPreviewMilestone,
  MppImportResultSummary,
  MppPortfolioSegment,
  ParsedMppProject,
  ParsedMppTask,
} from './mpp-import.types';

const PREVIEW_TASK_LIMIT = 250;
const DEFAULT_PHASE_NAME = 'Imported Schedule';

@Injectable()
export class MppImportMapper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute a non-destructive preview of what an import would create.
   * Performs read-only resource matching against existing users but never writes.
   */
  async buildPreview(
    parsed: ParsedMppProject,
    existingProjects: { id: string; name: string }[] = [],
  ): Promise<MppImportPreview> {
    if (this.isPortfolio(parsed)) {
      return this.buildPortfolioPreview(parsed, existingProjects);
    }

    return this.buildSinglePreview(parsed);
  }

  /**
   * Portfolio shape: L1 summaries are projects (each has nested summary = phase).
   * Single-project shape: L1 summaries are phases (children are leaves).
   */
  isPortfolio(parsed: ParsedMppProject): boolean {
    const allTasks = parsed.tasks ?? [];
    const projectRoots = this.getPortfolioProjectRoots(allTasks);
    return projectRoots.length > 0;
  }

  segmentPortfolio(parsed: ParsedMppProject): {
    segments: MppPortfolioSegment[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const allTasks = parsed.tasks ?? [];
    const byUid = this.indexByUid(allTasks);
    const projectRoots = this.getPortfolioProjectRoots(allTasks);
    const seenNames = new Set<string>();
    const segments: MppPortfolioSegment[] = [];

    for (const root of projectRoots) {
      const projectName = root.name.trim().slice(0, 255);
      const nameKey = projectName.toLowerCase();
      if (seenNames.has(nameKey)) {
        warnings.push(
          `Skipped duplicate project summary "${projectName}" in portfolio file.`,
        );
        continue;
      }
      seenNames.add(nameKey);

      const descendantUids = this.collectDescendantUids(root.uid, allTasks);
      const orderedDescendants = allTasks.filter((task) =>
        descendantUids.has(task.uid),
      );
      const remappedTasks: ParsedMppTask[] = [];
      const outlineParentStack: { uid: number; level: number }[] = [];

      for (const task of orderedDescendants) {
        const outlineLevel =
          task.outlineLevel != null
            ? Math.max(1, task.outlineLevel - 1)
            : 1;

        while (
          outlineParentStack.length > 0 &&
          outlineParentStack[outlineParentStack.length - 1].level >= outlineLevel
        ) {
          outlineParentStack.pop();
        }

        const parentUid =
          outlineParentStack.length > 0
            ? outlineParentStack[outlineParentStack.length - 1].uid
            : undefined;

        remappedTasks.push({
          ...task,
          parentUid,
          outlineLevel,
          predecessors: (task.predecessors ?? []).filter((predecessor) =>
            descendantUids.has(predecessor.predecessorUid),
          ),
        });

        if (task.summary) {
          outlineParentStack.push({ uid: task.uid, level: outlineLevel });
        }
      }

      const taskUids = new Set(remappedTasks.map((task) => task.uid));
      segments.push({
        projectName,
        startDate: root.startDate ?? parsed.project?.startDate,
        finishDate: root.finishDate ?? parsed.project?.finishDate,
        parsed: {
          project: {
            name: projectName,
            startDate: root.startDate ?? parsed.project?.startDate,
            finishDate: root.finishDate ?? parsed.project?.finishDate,
            baselineStartDate:
              root.baselineStartDate ?? parsed.project?.baselineStartDate,
            baselineFinishDate:
              root.baselineFinishDate ?? parsed.project?.baselineFinishDate,
            durationDays: root.durationDays ?? parsed.project?.durationDays,
            baselineDurationDays:
              root.baselineDurationDays ??
              parsed.project?.baselineDurationDays,
            actualStartDate:
              root.actualStartDate ?? parsed.project?.actualStartDate,
            actualFinishDate:
              root.actualFinishDate ?? parsed.project?.actualFinishDate,
            percentComplete:
              root.percentComplete ?? parsed.project?.percentComplete,
            durationVarianceDays:
              root.durationDays != null &&
              root.baselineDurationDays != null
                ? Math.round(
                    (Number(root.durationDays) -
                      Number(root.baselineDurationDays)) *
                      10,
                  ) / 10
                : parsed.project?.durationVarianceDays,
          },
          tasks: remappedTasks,
          resources: parsed.resources ?? [],
          assignments: (parsed.assignments ?? []).filter((assignment) =>
            taskUids.has(assignment.taskUid),
          ),
          warnings: [...(parsed.warnings ?? [])],
        },
      });
    }

    if (segments.length === 0) {
      warnings.push('No portfolio projects were found in this file.');
    }

    return { segments, warnings: [...warnings, ...(parsed.warnings ?? [])] };
  }

  findPortfolioSegmentByProjectName(
    parsed: ParsedMppProject,
    projectName: string,
  ): MppPortfolioSegment | undefined {
    const target = projectName.trim().toLowerCase();
    const { segments } = this.segmentPortfolio(parsed);
    return segments.find(
      (segment) => segment.projectName.trim().toLowerCase() === target,
    );
  }

  /**
   * Resolve which portfolio L1 project to import into an existing Cybsec project.
   * Prefer exact name match; if the file has exactly one L1 project, use it
   * (workspace "Import MPP into this project" even when titles differ slightly).
   */
  resolvePortfolioSegmentForProject(
    parsed: ParsedMppProject,
    projectName: string,
  ): MppPortfolioSegment | undefined {
    const byName = this.findPortfolioSegmentByProjectName(parsed, projectName);
    if (byName) return byName;

    const { segments } = this.segmentPortfolio(parsed);
    if (segments.length === 1) return segments[0];
    return undefined;
  }

  private async buildPortfolioPreview(
    parsed: ParsedMppProject,
    existingProjects: { id: string; name: string }[],
  ): Promise<MppImportPreview> {
    const { segments, warnings: segmentWarnings } =
      this.segmentPortfolio(parsed);
    const resourceMatch = await this.countResourceMatches(parsed);
    const existingByName = new Map(
      existingProjects.map((project) => [
        project.name.trim().toLowerCase(),
        project,
      ]),
    );

    const projects: MppImportPreviewProject[] = [];
    let importableTasks = 0;
    let phasesFromSummaries = 0;
    let milestonesFromFile = 0;
    let skippedSummaryTasks = 0;
    let dependencies = 0;
    const sampleTasks: MppImportPreview['tasks'] = [];
    const sampleMilestones: MppImportPreviewMilestone[] = [];

    for (const segment of segments) {
      const single = await this.buildSinglePreview(segment.parsed);
      importableTasks += single.counts.importableTasks;
      phasesFromSummaries += single.counts.phasesFromSummaries;
      milestonesFromFile += single.counts.milestonesFromFile;
      skippedSummaryTasks += single.counts.skippedSummaryTasks;
      dependencies += single.counts.dependencies;

      const existing = existingByName.get(
        segment.projectName.trim().toLowerCase(),
      );
      projects.push({
        name: segment.projectName,
        startDate: segment.startDate,
        finishDate: segment.finishDate,
        baselineStartDate: segment.parsed.project?.baselineStartDate,
        baselineFinishDate: segment.parsed.project?.baselineFinishDate,
        durationDays: segment.parsed.project?.durationDays,
        baselineDurationDays: segment.parsed.project?.baselineDurationDays,
        percentComplete: segment.parsed.project?.percentComplete,
        durationVarianceDays: segment.parsed.project?.durationVarianceDays,
        taskCount: single.counts.importableTasks,
        phaseCount: single.counts.phasesFromSummaries,
        milestoneCount: single.counts.milestonesFromFile,
        dependencyCount: single.counts.dependencies,
        importMode: existing ? 'update' : 'create',
        resolvedProjectId: existing?.id,
        tasks: single.tasks,
        milestones: single.milestones,
      });

      if (sampleTasks.length < PREVIEW_TASK_LIMIT) {
        sampleTasks.push(
          ...single.tasks.slice(0, PREVIEW_TASK_LIMIT - sampleTasks.length),
        );
      }
      if (sampleMilestones.length < PREVIEW_TASK_LIMIT) {
        sampleMilestones.push(
          ...single.milestones.slice(
            0,
            PREVIEW_TASK_LIMIT - sampleMilestones.length,
          ),
        );
      }
    }

    const warnings = [
      ...(parsed.warnings ?? []),
      ...segmentWarnings,
      ...resourceMatch.warnings,
      `Portfolio file: ${projects.length} project(s) detected (L1 summaries). Existing names will be updated, not duplicated.`,
    ];

    return {
      mode: 'portfolio',
      projectName: parsed.project?.name ?? 'Portfolio',
      startDate: parsed.project?.startDate,
      finishDate: parsed.project?.finishDate,
      counts: {
        importableTasks,
        phasesFromSummaries,
        milestonesFromFile,
        skippedSummaryTasks,
        dependencies,
        resourcesMatched: resourceMatch.matched,
        resourcesUnmatched: resourceMatch.unmatched,
        projects: projects.length,
      },
      projects,
      tasks: sampleTasks,
      milestones: sampleMilestones,
      warnings,
    };
  }

  private async buildSinglePreview(
    parsed: ParsedMppProject,
  ): Promise<MppImportPreview> {
    const allTasks = parsed.tasks ?? [];
    const byUid = this.indexByUid(allTasks);
    const phaseSummaries = this.getTopLevelPhaseSummaries(allTasks, byUid);
    const phaseNameByUid = new Map(
      phaseSummaries.map((summary) => [summary.uid, summary.name.trim()]),
    );

    const importableTasks = allTasks.filter((task) =>
      this.isImportableScheduleRow(task, byUid),
    );
    const milestoneTasks = this.getMppMilestoneTasks(allTasks);
    const nestedSummaryTasks = allTasks.filter(
      (task) =>
        task.summary &&
        task.name?.trim() &&
        !this.isTopLevelPhaseSummary(task, byUid) &&
        task.outlineLevel !== 0,
    ).length;
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

    const tasks = importableTasks.slice(0, PREVIEW_TASK_LIMIT).map((task) => {
      const phaseSummaryUid = this.resolvePhaseSummaryUid(task, byUid);
      return {
        uid: task.uid,
        name: task.name,
        startDate: task.startDate,
        finishDate: task.finishDate,
        durationDays: task.durationDays,
        baselineStartDate: task.baselineStartDate,
        baselineFinishDate: task.baselineFinishDate,
        baselineDurationDays: task.baselineDurationDays,
        actualStartDate: task.actualStartDate,
        actualFinishDate: task.actualFinishDate,
        percentComplete: task.percentComplete,
        phaseName: phaseSummaryUid
          ? phaseNameByUid.get(phaseSummaryUid)
          : undefined,
        hasParent: Boolean(
          task.parentUid && importableUids.has(task.parentUid),
        ),
        predecessorCount: (task.predecessors ?? []).filter((predecessor) =>
          importableUids.has(predecessor.predecessorUid),
        ).length,
      };
    });

    const milestones = this.mapMilestonePreviewRows(
      milestoneTasks,
      byUid,
      phaseNameByUid,
      PREVIEW_TASK_LIMIT,
    );

    const warnings = [...(parsed.warnings ?? []), ...resourceMatch.warnings];
    if (importableTasks.length > PREVIEW_TASK_LIMIT) {
      warnings.push(
        `Showing the first ${PREVIEW_TASK_LIMIT} of ${importableTasks.length} tasks. All tasks will be imported on save.`,
      );
    }
    if (importableTasks.length === 0 && milestoneTasks.length === 0) {
      warnings.push('No importable tasks were found in this file.');
    }
    if (phaseSummaries.length > 0) {
      warnings.push(
        `${phaseSummaries.length} top-level summary row(s) will be imported as phases.`,
      );
    }
    if (milestoneTasks.length > PREVIEW_TASK_LIMIT) {
      warnings.push(
        `Showing the first ${PREVIEW_TASK_LIMIT} of ${milestoneTasks.length} milestones. All milestones will be imported on save.`,
      );
    }
    if (nestedSummaryTasks > 0) {
      warnings.push(
        `${nestedSummaryTasks} nested summary row(s) will be imported as parent tasks under their phase.`,
      );
    }

    return {
      mode: 'single',
      projectName: parsed.project?.name,
      startDate: parsed.project?.startDate,
      finishDate: parsed.project?.finishDate,
      counts: {
        importableTasks: importableTasks.length,
        phasesFromSummaries: phaseSummaries.length,
        milestonesFromFile: milestoneTasks.length,
        skippedSummaryTasks: 0,
        dependencies,
        resourcesMatched: resourceMatch.matched,
        resourcesUnmatched: resourceMatch.unmatched,
      },
      tasks,
      milestones,
      warnings,
    };
  }

  private mapMilestonePreviewRows(
    milestoneTasks: ParsedMppTask[],
    byUid: Map<number, ParsedMppTask>,
    phaseNameByUid: Map<number, string>,
    limit: number,
  ): MppImportPreviewMilestone[] {
    return milestoneTasks.slice(0, limit).map((ms) => {
      const phaseSummaryUid = this.resolvePhaseSummaryUid(ms, byUid);
      return {
        uid: ms.uid,
        title: ms.name,
        targetDate: ms.finishDate ?? ms.startDate,
        phaseName: phaseSummaryUid
          ? phaseNameByUid.get(phaseSummaryUid)
          : undefined,
        percentComplete: ms.percentComplete,
        status: this.resolveMppMilestoneStatus(ms),
      };
    });
  }

  /** L1 summaries that have at least one nested summary child (= projects in a portfolio). */
  private getPortfolioProjectRoots(allTasks: ParsedMppTask[]): ParsedMppTask[] {
    const l1Summaries = allTasks.filter(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.outlineLevel === 1,
    );

    return l1Summaries.filter((root) => {
      if (
        allTasks.some(
          (child) =>
            child.summary &&
            child.name?.trim() &&
            child.parentUid === root.uid &&
            child.uid !== root.uid,
        )
      ) {
        return true;
      }

      const rootIndex = allTasks.findIndex((task) => task.uid === root.uid);
      if (rootIndex < 0) {
        return false;
      }

      for (let index = rootIndex + 1; index < allTasks.length; index += 1) {
        const task = allTasks[index];
        if (task.summary && task.outlineLevel === 1) {
          break;
        }
        if (task.summary && (task.outlineLevel ?? 2) > 1 && task.name?.trim()) {
          return true;
        }
      }
      return false;
    });
  }

  private collectDescendantUids(
    rootUid: number,
    allTasks: ParsedMppTask[],
  ): Set<number> {
    const childrenByParent = new Map<number, number[]>();
    for (const task of allTasks) {
      if (task.parentUid == null) {
        continue;
      }
      const list = childrenByParent.get(task.parentUid) ?? [];
      list.push(task.uid);
      childrenByParent.set(task.parentUid, list);
    }

    const result = new Set<number>();
    const stack = [...(childrenByParent.get(rootUid) ?? [])];
    while (stack.length > 0) {
      const uid = stack.pop()!;
      if (result.has(uid)) {
        continue;
      }
      result.add(uid);
      for (const childUid of childrenByParent.get(uid) ?? []) {
        stack.push(childUid);
      }
    }

    // Outline-order fallback when MPXJ/file did not wire parentUid links.
    if (result.size === 0) {
      const rootIndex = allTasks.findIndex((task) => task.uid === rootUid);
      const root = rootIndex >= 0 ? allTasks[rootIndex] : undefined;
      const rootLevel = root?.outlineLevel ?? 1;
      if (rootIndex >= 0) {
        for (let index = rootIndex + 1; index < allTasks.length; index += 1) {
          const task = allTasks[index];
          if (
            task.outlineLevel != null &&
            task.outlineLevel <= rootLevel
          ) {
            break;
          }
          if (task.summary && task.outlineLevel === rootLevel) {
            break;
          }
          result.add(task.uid);
        }
      }
    }

    return result;
  }

  async persistParsedProject(
    projectId: string,
    parsed: ParsedMppProject,
  ): Promise<MppImportResultSummary> {
    const warnings = [...(parsed.warnings ?? [])];
    const allTasks = parsed.tasks ?? [];
    const byUid = this.indexByUid(allTasks);
    const phaseSummaries = this.getTopLevelPhaseSummaries(allTasks, byUid);
    const importableTasks = allTasks.filter((task) =>
      this.isImportableScheduleRow(task, byUid),
    );
    const milestoneTasks = this.getMppMilestoneTasks(allTasks);

    if (importableTasks.length === 0 && milestoneTasks.length === 0) {
      throw new Error('No importable tasks or milestones found in the project file');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        phases: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, orderIndex: true, name: true },
        },
      },
    });

    if (!project) {
      throw new Error('Target project not found');
    }

    const uidToTaskId = new Map<number, string>();
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let dependenciesCreated = 0;
    let dependenciesUpdated = 0;
    let phasesCreated = 0;
    let phasesUpdated = 0;
    let milestonesCreated = 0;
    let milestonesUpdated = 0;
    let assignmentsApplied = 0;
    let assignmentsSkipped = 0;
    let resourceMatchForResult:
      | { matched: number; unmatched: number; warnings: string[] }
      | undefined;

    // Task lists sort by createdAt desc (newest on top). Create in reverse plan
    // order so the first schedule task is created last and appears at the top.
    const planIndexByUid = new Map(
      importableTasks.map((task, index) => [task.uid, index]),
    );

    const needsDefaultPhase = importableTasks.some(
      (task) => this.resolvePhaseSummaryUid(task, byUid) == null,
    );

    await this.prisma.$transaction(
      async (tx) => {
      const baselineTaskCount = importableTasks.filter(
        (task) => !!task.baselineStartDate,
      ).length;
      if (baselineTaskCount === 0) {
        warnings.push(
          'No baseline start dates on importable tasks after parse. Nested MSPDI <Baseline> may not have been applied.',
        );
      } else {
        warnings.push(
          `Persisting baselines for ${baselineTaskCount}/${importableTasks.length} tasks` +
            (parsed.project?.baselineStartDate
              ? `; project baseline ${parsed.project.baselineStartDate}→${parsed.project.baselineFinishDate}`
              : ''),
        );
      }

      await this.applyProjectScheduleFromParsed(tx, projectId, parsed);

      const summaryUidToPhaseId = new Map<number, string>();
      const phaseByName = new Map(
        project.phases.map((phase) => [
          phase.name.trim().toLowerCase(),
          phase,
        ]),
      );
      let nextOrderIndex =
        project.phases.reduce(
          (max, phase) => Math.max(max, phase.orderIndex),
          -1,
        ) + 1;

      for (const summary of phaseSummaries) {
        const phaseName = summary.name.trim().slice(0, 255);
        const startDate =
          this.parseDate(summary.startDate) ??
          this.parseDate(parsed.project?.startDate) ??
          project.startDate;
        const endDate =
          this.parseDate(summary.finishDate) ??
          this.parseDate(parsed.project?.finishDate) ??
          project.endDate;

        const existingPhase = phaseByName.get(phaseName.toLowerCase());
        if (existingPhase) {
          await tx.projectPhase.update({
            where: { id: existingPhase.id },
            data: { startDate, endDate },
          });
          summaryUidToPhaseId.set(summary.uid, existingPhase.id);
          phasesUpdated += 1;
        } else {
          const phase = await tx.projectPhase.create({
            data: {
              projectId: project.id,
              name: phaseName,
              orderIndex: nextOrderIndex++,
              startDate,
              endDate,
              status: PhaseStatus.Planned,
            },
          });
          summaryUidToPhaseId.set(summary.uid, phase.id);
          phaseByName.set(phaseName.toLowerCase(), {
            id: phase.id,
            orderIndex: phase.orderIndex,
            name: phase.name,
          });
          phasesCreated += 1;
        }
      }

      if (phasesCreated > 0 || phasesUpdated > 0) {
        warnings.push(
          `Phases from summary rows: ${phasesCreated} created, ${phasesUpdated} updated.`,
        );
      }

      let defaultPhaseId: string | undefined;
      if (needsDefaultPhase || phaseSummaries.length === 0) {
        const defaultPhase = await this.resolveDefaultPhaseId(
          tx,
          project,
          parsed,
          nextOrderIndex,
          phaseSummaries.length,
          warnings,
        );
        defaultPhaseId = defaultPhase.id;
        if (defaultPhase.created) {
          phasesCreated += 1;
        }
      }

      const milestoneResult = await this.importMppMilestones(
        tx,
        projectId,
        milestoneTasks,
        summaryUidToPhaseId,
        defaultPhaseId,
        byUid,
      );
      milestonesCreated += milestoneResult.created;
      milestonesUpdated += milestoneResult.updated;
      warnings.push(...milestoneResult.warnings);
      if (milestonesCreated > 0 || milestonesUpdated > 0) {
        warnings.push(
          `Milestones from MPP: ${milestonesCreated} created, ${milestonesUpdated} updated.`,
        );
      }

      const existingTasks = await tx.task.findMany({
        where: { projectId },
        select: { id: true, title: true, phaseId: true },
      });
      // Match by title + phase; consume each match once so duplicates create new.
      const existingTaskByKey = new Map<string, string>();
      for (const existing of existingTasks) {
        if (!existing.phaseId) {
          continue;
        }
        const key = this.taskMatchKey(existing.title, existing.phaseId);
        if (!existingTaskByKey.has(key)) {
          existingTaskByKey.set(key, existing.id);
        }
      }

      const pendingParents = [...importableTasks];
      // Stagger timestamps so order stays stable even when creates share a ms.
      let createdAtCursor = Date.now();

      while (pendingParents.length > 0) {
        const batch = pendingParents
          .filter((task) =>
            this.isTaskReadyToCreate(task, uidToTaskId, allTasks),
          )
          // Later plan tasks first → earlier plan tasks get newer createdAt.
          .sort(
            (a, b) =>
              (planIndexByUid.get(b.uid) ?? 0) - (planIndexByUid.get(a.uid) ?? 0),
          );

        if (batch.length === 0) {
          throw new Error('Unable to resolve task hierarchy from MPP file');
        }

        for (const task of batch) {
          const parentTaskId =
            task.parentUid && uidToTaskId.has(task.parentUid)
              ? uidToTaskId.get(task.parentUid)
              : undefined;

          const phaseSummaryUid = this.resolvePhaseSummaryUid(task, byUid);
          const phaseId =
            (phaseSummaryUid != null
              ? summaryUidToPhaseId.get(phaseSummaryUid)
              : undefined) ?? defaultPhaseId;

          if (!phaseId) {
            throw new Error(
              `Unable to resolve phase for imported task "${task.name}"`,
            );
          }

          const matchKey = this.taskMatchKey(task.name, phaseId);
          const existingTaskId = existingTaskByKey.get(matchKey);

          if (existingTaskId) {
            await tx.task.update({
              where: { id: existingTaskId },
              data: this.toTaskUpdateInput(phaseId, task, parentTaskId),
            });
            uidToTaskId.set(task.uid, existingTaskId);
            existingTaskByKey.delete(matchKey);
            tasksUpdated += 1;
          } else {
            const created = await tx.task.create({
              data: this.toTaskCreateInput(
                projectId,
                phaseId,
                task,
                parentTaskId,
                new Date(createdAtCursor++),
              ),
            });
            uidToTaskId.set(task.uid, created.id);
            tasksCreated += 1;
          }
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

          const depType = predecessor.type || 'FS';
          const lagDays = predecessor.lagDays ?? 0;
          const existingDep = await tx.taskDependency.findUnique({
            where: {
              predecessorId_successorId: { predecessorId, successorId },
            },
            select: { id: true },
          });

          if (existingDep) {
            await tx.taskDependency.update({
              where: { id: existingDep.id },
              data: { depType, lagDays },
            });
            dependenciesUpdated += 1;
          } else {
            await tx.taskDependency.create({
              data: {
                predecessorId,
                successorId,
                depType,
                lagDays,
              },
            });
            dependenciesCreated += 1;
          }
        }
      }

      const assignmentApply = await this.applyResourceAssignments(
        tx,
        parsed,
        uidToTaskId,
      );
      warnings.push(...assignmentApply.warnings);
      resourceMatchForResult = {
        matched: assignmentApply.resourcesMatched,
        unmatched: assignmentApply.resourcesUnmatched,
        warnings: assignmentApply.warnings,
      };
      assignmentsApplied = assignmentApply.assignmentsApplied;
      assignmentsSkipped = assignmentApply.assignmentsSkipped;
      },
      {
        // Large MSPDI/MPP files (1000+ tasks) exceed Prisma's default 5s interactive timeout.
        maxWait: 20_000,
        timeout: 300_000,
      },
    );

    const resourceMatch =
      resourceMatchForResult ?? (await this.countResourceMatches(parsed));

    return {
      tasksCreated,
      tasksUpdated,
      dependenciesCreated,
      dependenciesUpdated,
      phasesCreated,
      phasesUpdated,
      milestonesCreated,
      milestonesUpdated,
      resourcesMatched: resourceMatch.matched,
      assignmentsSkipped,
      warnings: [
        ...warnings.filter(
          (w, i, arr) =>
            // Drop duplicate assignment warnings already pushed inside tx.
            arr.indexOf(w) === i,
        ),
        ...(assignmentsApplied > 0
          ? [`Applied ${assignmentsApplied} resource assignment(s) to task owners.`]
          : []),
      ],
    };
  }

  /**
   * Top-level (outline level 1) summaries become ProjectPhase rows.
   * Nested summaries become parent tasks under their phase (hierarchy preserved).
   */
  private getTopLevelPhaseSummaries(
    allTasks: ParsedMppTask[],
    byUid: Map<number, ParsedMppTask>,
  ): ParsedMppTask[] {
    return allTasks.filter((task) => this.isTopLevelPhaseSummary(task, byUid));
  }

  /** Leaves + nested summaries (not project root, not phase summaries, not milestones). */
  private isImportableScheduleRow(
    task: ParsedMppTask,
    byUid: Map<number, ParsedMppTask>,
  ): boolean {
    if (!task.name?.trim()) {
      return false;
    }
    if (task.outlineLevel === 0) {
      return false;
    }
    if (this.isTopLevelPhaseSummary(task, byUid)) {
      return false;
    }
    if (this.isMppMilestone(task)) {
      return false;
    }
    return true;
  }

  /**
   * MS Project milestones: explicit Milestone flag, or zero-duration leaf rows
   * (diamond on Gantt). Named "Milestone" with duration > 0 stays a task.
   */
  private isMppMilestone(task: ParsedMppTask): boolean {
    if (!task.name?.trim() || task.summary || task.outlineLevel === 0) {
      return false;
    }
    if (task.milestone) {
      return true;
    }
    if (
      task.durationDays != null &&
      Number.isFinite(task.durationDays) &&
      task.durationDays > 0
    ) {
      return false;
    }
    if (task.startDate && task.finishDate) {
      return true;
    }
    return task.durationDays == null;
  }

  private getMppMilestoneTasks(allTasks: ParsedMppTask[]): ParsedMppTask[] {
    return allTasks.filter((task) => this.isMppMilestone(task));
  }

  private isTopLevelPhaseSummary(
    task: ParsedMppTask,
    byUid: Map<number, ParsedMppTask>,
  ): boolean {
    if (!task.summary || !task.name?.trim()) {
      return false;
    }

    // Project root summary is not a phase.
    if (task.outlineLevel === 0) {
      return false;
    }

    if (task.outlineLevel === 1) {
      return true;
    }

    if (task.outlineLevel != null && task.outlineLevel > 1) {
      return false;
    }

    // No outlineLevel: top-level if parent is missing or is the project root.
    if (!task.parentUid) {
      return true;
    }

    const parent = byUid.get(task.parentUid);
    if (!parent) {
      return true;
    }

    if (parent.outlineLevel === 0) {
      return true;
    }

    if (parent.summary && !parent.parentUid) {
      return true;
    }

    return false;
  }

  private resolvePhaseSummaryUid(
    task: ParsedMppTask,
    byUid: Map<number, ParsedMppTask>,
  ): number | undefined {
    let uid = task.parentUid;
    const visited = new Set<number>();

    while (uid != null && !visited.has(uid)) {
      visited.add(uid);
      const node = byUid.get(uid);
      if (!node) {
        return undefined;
      }
      if (this.isTopLevelPhaseSummary(node, byUid)) {
        return node.uid;
      }
      uid = node.parentUid;
    }

    return undefined;
  }

  private indexByUid(tasks: ParsedMppTask[]): Map<number, ParsedMppTask> {
    return new Map(tasks.map((task) => [task.uid, task]));
  }

  private async resolveDefaultPhaseId(
    tx: Prisma.TransactionClient,
    project: {
      id: string;
      startDate: Date;
      endDate: Date;
      phases: { id: string; orderIndex: number; name: string }[];
    },
    parsed: ParsedMppProject,
    nextOrderIndex: number,
    summaryPhasesCreated: number,
    warnings: string[],
  ): Promise<{ id: string; created: boolean }> {
    const existingDefault = project.phases.find(
      (phase) => phase.name === DEFAULT_PHASE_NAME,
    );
    if (existingDefault) {
      return { id: existingDefault.id, created: false };
    }

    // No summary-derived phases: reuse the first existing project phase if any.
    if (summaryPhasesCreated === 0 && project.phases[0]?.id) {
      return { id: project.phases[0].id, created: false };
    }

    const startDate =
      this.parseDate(parsed.project?.startDate) ?? project.startDate;
    const endDate =
      this.parseDate(parsed.project?.finishDate) ?? project.endDate;

    const phase = await tx.projectPhase.create({
      data: {
        projectId: project.id,
        name: DEFAULT_PHASE_NAME,
        orderIndex: nextOrderIndex,
        startDate,
        endDate,
        status: PhaseStatus.Planned,
      },
    });

    warnings.push(
      `Created default phase "${DEFAULT_PHASE_NAME}" for tasks without a summary group.`,
    );
    return { id: phase.id, created: true };
  }

  private milestoneMatchKey(title: string, phaseId: string | null): string {
    return `${phaseId ?? ''}|${title.trim().toLowerCase()}`;
  }

  private resolveMppMilestoneStatus(task: ParsedMppTask): string {
    if ((task.percentComplete ?? 0) >= 100) {
      return 'Completed';
    }
    if (task.actualFinishDate) {
      return 'Completed';
    }
    return 'Pending';
  }

  private async importMppMilestones(
    tx: Prisma.TransactionClient,
    projectId: string,
    milestoneTasks: ParsedMppTask[],
    summaryUidToPhaseId: Map<number, string>,
    defaultPhaseId: string | undefined,
    byUid: Map<number, ParsedMppTask>,
  ): Promise<{ created: number; updated: number; warnings: string[] }> {
    if (milestoneTasks.length === 0) {
      return { created: 0, updated: 0, warnings: [] };
    }

    const existing = await tx.projectMilestone.findMany({
      where: { projectId },
      select: { id: true, title: true, phaseId: true },
    });
    const existingByKey = new Map<string, string>();
    for (const row of existing) {
      const key = this.milestoneMatchKey(row.title, row.phaseId);
      if (!existingByKey.has(key)) {
        existingByKey.set(key, row.id);
      }
    }

    let created = 0;
    let updated = 0;
    const warnings: string[] = [];

    for (const ms of milestoneTasks) {
      const title = ms.name.trim().slice(0, 255);
      if (!title) {
        continue;
      }

      const phaseSummaryUid = this.resolvePhaseSummaryUid(ms, byUid);
      const phaseId =
        (phaseSummaryUid != null
          ? summaryUidToPhaseId.get(phaseSummaryUid)
          : undefined) ??
        defaultPhaseId ??
        null;

      const targetDate =
        this.parseDate(ms.finishDate) ??
        this.parseDate(ms.startDate) ??
        new Date();

      const status = this.resolveMppMilestoneStatus(ms);
      const key = this.milestoneMatchKey(title, phaseId);
      const existingId = existingByKey.get(key);

      if (existingId) {
        await tx.projectMilestone.update({
          where: { id: existingId },
          data: { targetDate, phaseId, status },
        });
        updated += 1;
      } else {
        const row = await tx.projectMilestone.create({
          data: {
            projectId,
            title,
            targetDate,
            phaseId,
            status,
            weight: null,
          },
        });
        existingByKey.set(key, row.id);
        created += 1;
      }
    }

    return { created, updated, warnings };
  }

  private taskMatchKey(title: string, phaseId: string): string {
    return `${phaseId}|${title.trim().toLowerCase()}`;
  }

  private taskScheduleFields(task: ParsedMppTask): {
    title: string;
    description: string | undefined;
    startDate: Date | undefined;
    endDate: Date | undefined;
    baselineStart: Date | undefined;
    baselineEnd: Date | undefined;
    actualStart: Date | undefined;
    actualEnd: Date | undefined;
    durationDays: number | undefined;
    baselineDurationDays: number | undefined;
    effortHours: number | undefined;
    progressApproved: number;
    status: TaskStatus;
  } {
    const progress = Math.max(0, Math.min(100, task.percentComplete ?? 0));
    const status =
      progress >= 100
        ? TaskStatus.Done
        : progress > 0
          ? TaskStatus.In_Progress
          : TaskStatus.To_Do;

    const startDate = this.parseDate(task.startDate);
    const endDate = this.parseDate(task.finishDate);
    const baselineStart = this.parseDate(task.baselineStartDate);
    const baselineEnd = this.parseDate(task.baselineFinishDate);
    const actualStart = this.parseDate(task.actualStartDate);
    const actualEnd = this.parseDate(task.actualFinishDate);

    const durationDays = this.normalizeDurationDays(task.durationDays);
    const baselineDurationDays = this.normalizeDurationDays(
      task.baselineDurationDays,
    );

    const effortFromDuration =
      durationDays != null && durationDays > 0
        ? Math.max(1, Math.round(durationDays * 8))
        : undefined;

    return {
      title: task.name.slice(0, 255),
      description: task.wbs ? `WBS: ${task.wbs}` : undefined,
      startDate,
      endDate,
      // Only store true MSP baselines; do not copy current dates as baseline.
      baselineStart,
      baselineEnd,
      actualStart,
      actualEnd,
      durationDays,
      baselineDurationDays,
      effortHours: effortFromDuration,
      progressApproved: progress,
      status,
    };
  }

  private normalizeDurationDays(value?: number | null): number | undefined {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      return undefined;
    }
    return Math.round(Number(value) * 10) / 10;
  }

  private async applyProjectScheduleFromParsed(
    tx: Prisma.TransactionClient,
    projectId: string,
    parsed: ParsedMppProject,
  ): Promise<void> {
    const props = { ...(parsed.project ?? {}) };

    // Fallback: if portfolio segment lost project baselines, take from any summary row.
    if (!props.baselineStartDate || !props.baselineFinishDate) {
      const summaryWithBaseline = (parsed.tasks ?? []).find(
        (task) =>
          task.summary &&
          (task.baselineStartDate || task.baselineFinishDate),
      );
      if (summaryWithBaseline) {
        props.baselineStartDate =
          props.baselineStartDate ?? summaryWithBaseline.baselineStartDate;
        props.baselineFinishDate =
          props.baselineFinishDate ?? summaryWithBaseline.baselineFinishDate;
        props.baselineDurationDays =
          props.baselineDurationDays ??
          summaryWithBaseline.baselineDurationDays;
        props.durationDays =
          props.durationDays ?? summaryWithBaseline.durationDays;
        props.actualStartDate =
          props.actualStartDate ?? summaryWithBaseline.actualStartDate;
        props.actualFinishDate =
          props.actualFinishDate ?? summaryWithBaseline.actualFinishDate;
        props.percentComplete =
          props.percentComplete ?? summaryWithBaseline.percentComplete;
      }
    }

    // Prefer L1/L0 summary % when project props still lack it.
    if (props.percentComplete == null) {
      const rootSummary = (parsed.tasks ?? []).find(
        (task) =>
          task.summary &&
          ((task.outlineLevel ?? -1) === 1 || (task.outlineLevel ?? -1) === 0) &&
          task.percentComplete != null,
      );
      if (rootSummary?.percentComplete != null) {
        props.percentComplete = rootSummary.percentComplete;
      }
    }

    const startDate = this.parseDate(props.startDate);
    const endDate = this.parseDate(props.finishDate);
    const baselineStartDate = this.parseDate(props.baselineStartDate);
    const baselineEndDate = this.parseDate(props.baselineFinishDate);
    const actualStartDate = this.parseDate(props.actualStartDate);
    const actualEndDate = this.parseDate(props.actualFinishDate);
    const durationDays = this.normalizeDurationDays(props.durationDays);
    const baselineDurationDays = this.normalizeDurationDays(
      props.baselineDurationDays,
    );
    const percentComplete = this.normalizePercent(props.percentComplete);
    const durationVarianceDays = this.computeDurationVarianceDays(
      durationDays,
      baselineDurationDays,
      startDate,
      endDate,
      baselineStartDate,
      baselineEndDate,
    );

    const data: Record<string, unknown> = {};
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;
    if (baselineStartDate) data.baselineStartDate = baselineStartDate;
    if (baselineEndDate) data.baselineEndDate = baselineEndDate;
    if (actualStartDate) data.actualStartDate = actualStartDate;
    if (actualEndDate) data.actualEndDate = actualEndDate;
    if (durationDays != null) data.durationDays = durationDays;
    if (baselineDurationDays != null) {
      data.baselineDurationDays = baselineDurationDays;
    }
    if (percentComplete != null) data.percentComplete = percentComplete;
    if (durationVarianceDays != null) {
      data.durationVarianceDays = durationVarianceDays;
    }

    if (Object.keys(data).length === 0) return;

    await tx.project.update({
      where: { id: projectId },
      data: data as Prisma.ProjectUpdateInput,
    });
  }

  private normalizePercent(value?: number | null): number | undefined {
    if (value == null || !Number.isFinite(Number(value))) return undefined;
    return Math.max(0, Math.min(100, Math.round(Number(value))));
  }

  private computeDurationVarianceDays(
    durationDays?: number,
    baselineDurationDays?: number,
    startDate?: Date,
    endDate?: Date,
    baselineStartDate?: Date,
    baselineEndDate?: Date,
  ): number | undefined {
    if (
      durationDays != null &&
      baselineDurationDays != null &&
      Number.isFinite(durationDays) &&
      Number.isFinite(baselineDurationDays)
    ) {
      return Math.round((durationDays - baselineDurationDays) * 10) / 10;
    }
    if (startDate && endDate && baselineStartDate && baselineEndDate) {
      const currentDays =
        Math.round(
          (endDate.getTime() - startDate.getTime()) / 86_400_000,
        ) + 1;
      const baselineDays =
        Math.round(
          (baselineEndDate.getTime() - baselineStartDate.getTime()) /
            86_400_000,
        ) + 1;
      return Math.round((currentDays - baselineDays) * 10) / 10;
    }
    return undefined;
  }

  private toTaskCreateInput(
    projectId: string,
    phaseId: string,
    task: ParsedMppTask,
    parentTaskId?: string,
    createdAt?: Date,
  ): Prisma.TaskCreateInput {
    const fields = this.taskScheduleFields(task);

    return {
      project: { connect: { id: projectId } },
      phase: { connect: { id: phaseId } },
      parentTask: parentTaskId ? { connect: { id: parentTaskId } } : undefined,
      title: fields.title,
      description: fields.description,
      startDate: fields.startDate ?? null,
      endDate: fields.endDate ?? null,
      baselineStart: fields.baselineStart ?? null,
      baselineEnd: fields.baselineEnd ?? null,
      actualStart: fields.actualStart ?? null,
      actualEnd: fields.actualEnd ?? null,
      durationDays: fields.durationDays ?? null,
      baselineDurationDays: fields.baselineDurationDays ?? null,
      effortHours: fields.effortHours ?? null,
      progressApproved: fields.progressApproved,
      status: fields.status,
      ...(createdAt ? { createdAt } : {}),
    };
  }

  private toTaskUpdateInput(
    phaseId: string,
    task: ParsedMppTask,
    parentTaskId?: string,
  ): Prisma.TaskUpdateInput {
    const fields = this.taskScheduleFields(task);

    return {
      phase: { connect: { id: phaseId } },
      parentTask: parentTaskId
        ? { connect: { id: parentTaskId } }
        : { disconnect: true },
      title: fields.title,
      description: fields.description,
      startDate: fields.startDate ?? null,
      endDate: fields.endDate ?? null,
      baselineStart: fields.baselineStart ?? null,
      baselineEnd: fields.baselineEnd ?? null,
      actualStart: fields.actualStart ?? null,
      actualEnd: fields.actualEnd ?? null,
      durationDays: fields.durationDays ?? null,
      baselineDurationDays: fields.baselineDurationDays ?? null,
      effortHours: fields.effortHours ?? null,
      progressApproved: fields.progressApproved,
      status: fields.status,
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

    const byUid = this.indexByUid(allTasks);
    const parent = byUid.get(task.parentUid);
    if (!parent) {
      return true;
    }

    // Parent is project root or a phase summary — no parent task row required.
    if (parent.outlineLevel === 0 || this.isTopLevelPhaseSummary(parent, byUid)) {
      return true;
    }

    // Nested summary / parent task must exist first.
    return false;
  }

  private async countResourceMatches(parsed: ParsedMppProject): Promise<{
    matched: number;
    unmatched: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let matched = 0;
    let unmatched = 0;
    const seen = new Set<string>();

    for (const resource of parsed.resources ?? []) {
      const email = resource.email?.trim().toLowerCase();
      const name = resource.name?.trim();
      if (!email && !name) continue;

      const key = `${email || ''}|${name || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const user = await this.findUserForResource(resource);
      if (user) {
        matched += 1;
      } else {
        unmatched += 1;
        warnings.push(`Unmapped resource: ${name ?? email}`);
      }
    }

    return { matched, unmatched, warnings };
  }

  /**
   * Apply MSP assignments → task.owner / backupOwner when the resource matches
   * a Cybsec user; always persist Resource Names text for XML round-trip.
   */
  private async applyResourceAssignments(
    tx: Prisma.TransactionClient,
    parsed: ParsedMppProject,
    uidToTaskId: Map<number, string>,
  ): Promise<{
    resourcesMatched: number;
    resourcesUnmatched: number;
    assignmentsApplied: number;
    assignmentsSkipped: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const resourcesByUid = new Map(
      (parsed.resources ?? []).map((r) => [r.uid, r]),
    );

    const userByResourceUid = new Map<number, string>();
    const matchedResourceKeys = new Set<string>();
    const unmatchedResourceKeys = new Set<string>();

    for (const resource of parsed.resources ?? []) {
      if (!resource.name?.trim() && !resource.email?.trim()) continue;
      const user = await this.findUserForResource(resource);
      const key = `${resource.email || ''}|${resource.name || ''}`;
      if (user) {
        userByResourceUid.set(resource.uid, user.id);
        matchedResourceKeys.add(key);
      } else {
        unmatchedResourceKeys.add(key);
        warnings.push(`Unmapped resource: ${resource.name ?? resource.email}`);
      }
    }

    type Acc = {
      userIds: string[];
    };
    const byTaskId = new Map<string, Acc>();
    let assignmentsApplied = 0;
    let assignmentsSkipped = 0;

    for (const assignment of parsed.assignments ?? []) {
      const taskId = uidToTaskId.get(assignment.taskUid);
      const resource = resourcesByUid.get(assignment.resourceUid);
      if (!taskId || !resource?.name?.trim()) {
        assignmentsSkipped += 1;
        continue;
      }

      const userId = userByResourceUid.get(resource.uid);
      if (!userId) {
        // Unmatched resources are warned above; do not store their names.
        assignmentsSkipped += 1;
        continue;
      }

      const acc = byTaskId.get(taskId) ?? { userIds: [] };
      if (!acc.userIds.includes(userId)) {
        acc.userIds.push(userId);
      }
      byTaskId.set(taskId, acc);
      assignmentsApplied += 1;
    }

    // Clear any previously stored MPP Resource Names text; keep only matched owners.
    for (const taskId of uidToTaskId.values()) {
      const acc = byTaskId.get(taskId);
      const ownerId = acc?.userIds[0] ?? null;
      const backupOwnerId = acc?.userIds[1] ?? null;
      await tx.task.update({
        where: { id: taskId },
        data: {
          resourceNames: null,
          ...(acc
            ? {
                ownerId,
                backupOwnerId:
                  backupOwnerId && backupOwnerId !== ownerId
                    ? backupOwnerId
                    : null,
              }
            : {}),
        },
      });
    }

    return {
      resourcesMatched: matchedResourceKeys.size,
      resourcesUnmatched: unmatchedResourceKeys.size,
      assignmentsApplied,
      assignmentsSkipped,
      warnings,
    };
  }

  /** Match "Name (Org)" against Cybsec users by email or bare display name. */
  private async findUserForResource(resource: {
    name?: string;
    email?: string;
  }): Promise<{ id: string } | null> {
    const email = resource.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (byEmail) return byEmail;
    }

    const rawName = resource.name?.trim();
    if (!rawName) return null;
    const bareName = this.stripResourceOrganization(rawName);

    const byName = await this.prisma.user.findFirst({
      where: {
        OR: [
          { displayName: { equals: rawName, mode: 'insensitive' } },
          { displayName: { equals: bareName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return byName;
  }

  /** "Vinayak Sonkavada (CyberKnight)" → "Vinayak Sonkavada" */
  private stripResourceOrganization(name: string): string {
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
  }
}
