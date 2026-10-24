import { Injectable } from '@nestjs/common';
import {
  PhaseStatus,
  Prisma,
  PriorityLevel,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  MppImportPreview,
  MppImportPreviewPhase,
  MppImportPreviewProject,
  MppImportPreviewMilestone,
  MppImportPreviewTask,
  MppImportResultSummary,
  MppPortfolioSegment,
  ParsedMppProject,
  ParsedMppTask,
} from './mpp-import.types';
import { joinResourceNames } from './resource-names.util';
import { PROJECT_NAME_MAX_LENGTH } from '../projects/constants/project-limits';
import {
  fromMspdiDateTime,
  resolveMspExportTimeZone,
} from './mspdi-datetime.util';
import { renumberProjectPlanRows } from '../projects/utils/plan-row.util';

const PREVIEW_TASK_LIMIT = 250;
const DEFAULT_PHASE_NAME = 'Imported Schedule';

@Injectable()
export class MppImportMapper {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Compute a non-destructive preview of what an import would create.
   * Performs read-only resource matching against existing users but never writes.
   */
  async buildPreview(
    parsed: ParsedMppProject,
    existingProjects: { id: string; name: string }[] = [],
    options?: { forceSingle?: boolean; targetProjectId?: string },
  ): Promise<MppImportPreview> {
    if (!options?.forceSingle && this.isPortfolio(parsed)) {
      return this.buildPortfolioPreview(parsed, existingProjects);
    }

    return this.buildSinglePreview(parsed, existingProjects, {
      targetProjectId: options?.targetProjectId,
    });
  }

  /**
   * Portfolio: several L1 summaries that are themselves projects (no outline-0 wrapper).
   * Single-project (DLP-style): outline-0 project row, then L1 phases with nested summaries.
   * Nested summaries under a phase must NOT be treated as a multi-project file.
   */
  isPortfolio(parsed: ParsedMppProject): boolean {
    const allTasks = parsed.tasks ?? [];
    const hasProjectRoot = allTasks.some(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.outlineLevel === 0,
    );
    if (hasProjectRoot) {
      return false;
    }
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
      const projectName = root.name.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
      const nameKey = projectName;
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
            cost: root.cost ?? parsed.project?.cost,
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
    const target = projectName.trim();
    const { segments } = this.segmentPortfolio(parsed);
    return segments.find(
      (segment) => segment.projectName.trim() === target,
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
      existingProjects.map((project) => [project.name.trim(), project]),
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
      const existing = existingByName.get(segment.projectName.trim());
      const single = await this.buildSinglePreview(segment.parsed, existingProjects, {
        targetProjectId: existing?.id,
      });
      importableTasks += single.counts.importableTasks;
      phasesFromSummaries += single.counts.phasesFromSummaries;
      milestonesFromFile += single.counts.milestonesFromFile;
      skippedSummaryTasks += single.counts.skippedSummaryTasks;
      dependencies += single.counts.dependencies;

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
        cost: segment.parsed.project?.cost,
        taskCount: single.counts.importableTasks,
        phaseCount: single.counts.phasesFromSummaries,
        milestoneCount: single.counts.milestonesFromFile,
        dependencyCount: single.counts.dependencies,
        importMode: existing ? 'update' : 'create',
        resolvedProjectId: existing?.id,
        phases: single.phases,
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
      cost: parsed.project?.cost,
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
    existingProjects: { id: string; name: string }[] = [],
    options?: { targetProjectId?: string },
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
    const hasMilestoneFlagDef = (parsed.customFieldDefs ?? []).some(
      (d) =>
        (d.fieldName || '').toLowerCase() === 'flag1' ||
        (d.alias || '').toLowerCase() === 'ismilestone',
    );
    const milestoneTasks = this.getMppMilestoneTasks(allTasks, hasMilestoneFlagDef);
    const nestedSummaryTasks = allTasks.filter(
      (task) =>
        task.summary &&
        task.name?.trim() &&
        !this.isTopLevelPhaseSummary(task, byUid) &&
        !this.isScheduleWrapperSummary(task, byUid) &&
        task.outlineLevel !== 0,
    ).length;
    const importableUids = new Set(importableTasks.map((task) => task.uid));
    const resourceNamesByUid = await this.resourceNamesByTaskUid(parsed);

    let dependencies = 0;
    for (const task of importableTasks) {
      for (const predecessor of task.predecessors ?? []) {
        if (importableUids.has(predecessor.predecessorUid)) {
          dependencies += 1;
        }
      }
    }

    const resourceMatch = await this.countResourceMatches(parsed);

    let tasks: MppImportPreviewTask[] = importableTasks
      .slice(0, PREVIEW_TASK_LIMIT)
      .map((task) => {
        const phaseSummaryUid = this.resolvePhaseSummaryUid(task, byUid);
        const notes = task.notes?.trim();
        return {
          uid: task.uid,
          name: task.name,
          startDate: task.startDate,
          finishDate: task.finishDate,
          durationDays: task.durationDays,
          workHours: task.workHours,
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
          importMode: 'create' as const,
          priority: this.mapMspPriorityToLevel(task.priority),
          assigneeNames: resourceNamesByUid.get(task.uid) ?? [],
          notesPreview: notes ? notes.slice(0, 120) : undefined,
        };
      });

    let milestones = this.mapMilestonePreviewRows(
      milestoneTasks,
      byUid,
      phaseNameByUid,
      PREVIEW_TASK_LIMIT,
    );

    let phases: MppImportPreviewPhase[] = phaseSummaries.map((summary) => ({
      name: summary.name.trim(),
      startDate: summary.startDate,
      finishDate: summary.finishDate,
      durationDays: summary.durationDays,
      percentComplete: summary.percentComplete,
      importMode: 'create' as const,
    }));

    const projectName = this.resolveVisibleProjectName(parsed, byUid);
    const existing =
      (options?.targetProjectId
        ? existingProjects.find((p) => p.id === options.targetProjectId)
        : undefined) ??
      this.findExistingProjectByName(
        existingProjects,
        projectName,
        parsed.project?.name,
      );

    if (existing) {
      const annotated = await this.annotatePreviewAgainstExisting(
        existing.id,
        phases,
        tasks,
        milestones,
      );
      phases = annotated.phases;
      tasks = annotated.tasks;
      milestones = annotated.milestones;
    }

    const warnings = [...(parsed.warnings ?? []), ...resourceMatch.warnings];
    if (importableTasks.length > PREVIEW_TASK_LIMIT) {
      warnings.push(
        `Showing the first ${PREVIEW_TASK_LIMIT} of ${importableTasks.length} tasks. All tasks will be imported on save.`,
      );
    }
    if (importableTasks.length === 0 && milestoneTasks.length === 0) {
      warnings.push('No importable tasks were found in this file.');
    }
    const wrapper = this.getScheduleWrapperSummary(byUid);
    if (wrapper) {
      warnings.push(
        `Skipped project summary "${wrapper.name.trim()}" — it is the plan name, not a phase.`,
      );
    }
    if (phaseSummaries.length > 0) {
      const phaseUpdates = phases.filter((p) => p.importMode === 'update').length;
      const phaseCreates = phases.length - phaseUpdates;
      warnings.push(
        `${phases.length} phase(s): ${phaseUpdates} update, ${phaseCreates} new.`,
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
    if (milestoneTasks.length > 0) {
      const msUpdates = milestones.filter((m) => m.importMode === 'update').length;
      warnings.push(
        `${milestoneTasks.length} milestone(s): ${msUpdates} update, ${milestoneTasks.length - msUpdates} new.`,
      );
    }
    if (existing) {
      const taskUpdates = tasks.filter((t) => t.importMode === 'update').length;
      warnings.push(
        `Matching existing project "${existing.name}" — ${taskUpdates} task(s) update, ${tasks.length - taskUpdates} new (matched by title + phase).`,
      );
    }

    return {
      mode: 'single',
      projectName,
      importMode: existing ? 'update' : 'create',
      resolvedProjectId: existing?.id,
      startDate: parsed.project?.startDate,
      finishDate: parsed.project?.finishDate,
      cost: parsed.project?.cost,
      counts: {
        importableTasks: importableTasks.length,
        phasesFromSummaries: phaseSummaries.length,
        milestonesFromFile: milestoneTasks.length,
        skippedSummaryTasks: 0,
        dependencies,
        resourcesMatched: resourceMatch.matched,
        resourcesUnmatched: resourceMatch.unmatched,
      },
      phases,
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
        importMode: 'create' as const,
      };
    });
  }

  /** MSP Resource Names per task UID (preview assignees). Only matched DB users are returned. */
  private async resourceNamesByTaskUid(
    parsed: ParsedMppProject,
  ): Promise<Map<number, string[]>> {
    const matchedUserByResourceUid = new Map<number, string>();
    for (const resource of parsed.resources ?? []) {
      if (!resource.name?.trim() && !resource.email?.trim()) continue;
      const user = await this.findUserForResource(resource);
      if (user?.displayName) {
        matchedUserByResourceUid.set(resource.uid, user.displayName);
      }
    }

    const namesByTask = new Map<number, string[]>();
    for (const assignment of parsed.assignments ?? []) {
      const matchedName = matchedUserByResourceUid.get(assignment.resourceUid);
      if (!matchedName) continue;
      const list = namesByTask.get(assignment.taskUid) ?? [];
      if (!list.includes(matchedName)) list.push(matchedName);
      namesByTask.set(assignment.taskUid, list);
    }
    return namesByTask;
  }

  /**
   * Mark preview rows NEW vs UPDATE using the same title+phase matching as persist.
   * Also attach short field-change hints for UPDATE rows.
   */
  private async annotatePreviewAgainstExisting(
    projectId: string,
    phases: MppImportPreviewPhase[],
    tasks: MppImportPreviewTask[],
    milestones: MppImportPreviewMilestone[],
  ): Promise<{
    phases: MppImportPreviewPhase[];
    tasks: MppImportPreviewTask[];
    milestones: MppImportPreviewMilestone[];
  }> {
    const existingPhases = await this.prisma.projectPhase.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        description: true,
        taskId: true,
        task: {
          select: {
            durationDays: true,
            progressApproved: true,
            status: true,
          },
        },
      },
    });
    const phaseTwinIds = new Set(
      existingPhases
        .map((p) => p.taskId)
        .filter((id): id is string => Boolean(id)),
    );
    const phaseByName = new Map(
      existingPhases.map((p) => [p.name.trim().toLowerCase(), p]),
    );

    const existingTasks = await this.prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        phaseId: true,
        status: true,
        progressApproved: true,
        durationDays: true,
        startDate: true,
        endDate: true,
        description: true,
        priority: true,
        owner: { select: { displayName: true } },
        backupOwner: { select: { displayName: true } },
      },
    });
    const existingTaskByKey = new Map<
      string,
      (typeof existingTasks)[number]
    >();
    for (const row of existingTasks) {
      if (!row.phaseId || phaseTwinIds.has(row.id)) continue;
      const key = this.taskMatchKey(row.title, row.phaseId, null);
      if (!existingTaskByKey.has(key)) {
        existingTaskByKey.set(key, row);
      }
    }

    const existingMilestones = await this.prisma.projectMilestone.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        phaseId: true,
        status: true,
        targetDate: true,
      },
    });
    const existingMsByKey = new Map<
      string,
      (typeof existingMilestones)[number]
    >();
    for (const row of existingMilestones) {
      const key = this.milestoneMatchKey(row.title, row.phaseId);
      if (!existingMsByKey.has(key)) {
        existingMsByKey.set(key, row);
      }
    }

    const annotatedPhases = phases.map((phase) => {
      const existing = phaseByName.get(phase.name.trim().toLowerCase());
      if (!existing) return phase;
      const details: string[] = [];
      if (
        this.previewDateChanged(existing.startDate, phase.startDate) ||
        this.previewDateChanged(existing.endDate, phase.finishDate)
      ) {
        details.push('dates');
      }
      if (
        phase.durationDays != null &&
        Number(existing.task?.durationDays ?? NaN) !== Number(phase.durationDays)
      ) {
        details.push('duration');
      }
      if (
        phase.percentComplete != null &&
        Number(existing.task?.progressApproved ?? 0) !==
        Math.round(phase.percentComplete)
      ) {
        details.push('% complete');
      }
      return {
        ...phase,
        importMode: 'update' as const,
        updateDetails: details.length ? details : ['schedule'],
      };
    });

    // Resolve file phase name → existing phase id (after name match / create path).
    const phaseIdByPreviewName = new Map<string, string>();
    for (const phase of annotatedPhases) {
      const existing = phaseByName.get(phase.name.trim().toLowerCase());
      if (existing) {
        phaseIdByPreviewName.set(phase.name.trim().toLowerCase(), existing.id);
      }
    }

    const usedTaskKeys = new Set<string>();
    const annotatedTasks = tasks.map((task) => {
      const phaseKey = (task.phaseName?.trim() || '').toLowerCase();
      const phaseId = phaseIdByPreviewName.get(phaseKey);
      if (!phaseId) {
        return task; // phase is new → task will be created
      }
      const matchKey = this.taskMatchKey(task.name, phaseId, null);
      if (usedTaskKeys.has(matchKey)) {
        return task;
      }
      const existing = existingTaskByKey.get(matchKey);
      if (!existing) {
        return task;
      }
      usedTaskKeys.add(matchKey);

      const details: string[] = [];
      const incomingStatus =
        (task.percentComplete ?? 0) >= 100
          ? 'Done'
          : (task.percentComplete ?? 0) > 0
            ? 'In_Progress'
            : 'To_Do';
      if (existing.status !== incomingStatus) {
        details.push(`status → ${incomingStatus.replace('_', ' ')}`);
      }
      if (
        this.previewDateChanged(existing.startDate, task.startDate) ||
        this.previewDateChanged(existing.endDate, task.finishDate)
      ) {
        details.push('dates');
      }
      if (
        task.durationDays != null &&
        Number(existing.durationDays ?? NaN) !== Number(task.durationDays)
      ) {
        details.push(`duration ${task.durationDays}d`);
      }
      if (task.notesPreview && task.notesPreview !== (existing.description || '').slice(0, 120)) {
        details.push('notes');
      }
      if (task.priority && task.priority !== existing.priority) {
        details.push(`priority ${task.priority}`);
      }
      const incomingAssignees = (task.assigneeNames ?? []).join(', ');
      const existingAssignees = [
        existing.owner?.displayName,
        existing.backupOwner?.displayName,
      ]
        .filter(Boolean)
        .join(', ');
      if (incomingAssignees && incomingAssignees !== existingAssignees) {
        details.push(`assignee ${incomingAssignees}`);
      }
      if (
        task.percentComplete != null &&
        Number(existing.progressApproved ?? 0) !==
        Math.round(task.percentComplete)
      ) {
        details.push(`${Math.round(task.percentComplete)}%`);
      }

      return {
        ...task,
        importMode: 'update' as const,
        updateDetails: details.length ? details.slice(0, 5) : ['schedule'],
      };
    });

    const usedMsKeys = new Set<string>();
    const annotatedMilestones = milestones.map((ms) => {
      const phaseKey = (ms.phaseName?.trim() || '').toLowerCase();
      const phaseId = phaseIdByPreviewName.get(phaseKey) ?? null;
      // Milestones under a brand-new phase name → create
      if (ms.phaseName?.trim() && !phaseId) {
        return ms;
      }
      const key = this.milestoneMatchKey(ms.title, phaseId);
      if (usedMsKeys.has(key)) return ms;
      const existing = existingMsByKey.get(key);
      if (!existing) return ms;
      usedMsKeys.add(key);

      const details: string[] = [];
      if (existing.status !== ms.status) {
        details.push(`status → ${ms.status}`);
      }
      if (this.previewDateChanged(existing.targetDate, ms.targetDate)) {
        details.push('target date');
      }
      return {
        ...ms,
        importMode: 'update' as const,
        updateDetails: details.length ? details : ['schedule'],
      };
    });

    return {
      phases: annotatedPhases,
      tasks: annotatedTasks,
      milestones: annotatedMilestones,
    };
  }

  private previewDateChanged(
    existing: Date | string | null | undefined,
    incoming?: string,
  ): boolean {
    if (!incoming) return false;
    if (!existing) return true;
    const a =
      existing instanceof Date
        ? existing.toISOString().slice(0, 10)
        : String(existing).slice(0, 10);
    const b = incoming.slice(0, 10);
    return a !== b;
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
    timeZone?: string,
  ): Promise<MppImportResultSummary> {
    const tz = resolveMspExportTimeZone(timeZone);
    const warnings = [...(parsed.warnings ?? [])];
    const allTasks = parsed.tasks ?? [];
    const byUid = this.indexByUid(allTasks);
    const phaseSummaries = this.getTopLevelPhaseSummaries(allTasks, byUid);
    const importableTasks = allTasks.filter((task) =>
      this.isImportableScheduleRow(task, byUid),
    );
    const hasMilestoneFlagDef = (parsed.customFieldDefs ?? []).some(
      (d) =>
        (d.fieldName || '').toLowerCase() === 'flag1' ||
        (d.alias || '').toLowerCase() === 'ismilestone',
    );
    const milestoneTasks = this.getMppMilestoneTasks(allTasks, hasMilestoneFlagDef);

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
          select: { id: true, orderIndex: true, name: true, taskId: true },
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

        await this.applyProjectScheduleFromParsed(tx, projectId, parsed, tz);

        const summaryUidToPhaseId = new Map<number, string>();
        const phaseTwinIds = new Set<string>();
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
            this.parseDate(summary.startDate, tz) ??
            this.parseDate(parsed.project?.startDate, tz) ??
            project.startDate;
          const endDate =
            this.parseDate(summary.finishDate, tz) ??
            this.parseDate(parsed.project?.finishDate, tz) ??
            project.endDate;
          const scheduleFields = this.taskScheduleFields(summary, tz);

          const existingPhase = phaseByName.get(phaseName.toLowerCase());
          let phaseId: string;
          let twinTaskId: string | null | undefined =
            existingPhase && 'taskId' in existingPhase
              ? (existingPhase as { taskId?: string | null }).taskId
              : undefined;

          if (existingPhase) {
            await tx.projectPhase.update({
              where: { id: existingPhase.id },
              data: {
                startDate,
                endDate,
                ...(scheduleFields.description
                  ? { description: scheduleFields.description }
                  : {}),
              },
            });
            phaseId = existingPhase.id;
            summaryUidToPhaseId.set(summary.uid, existingPhase.id);
            phasesUpdated += 1;
            twinTaskId =
              (
                await tx.projectPhase.findUnique({
                  where: { id: existingPhase.id },
                  select: { taskId: true },
                })
              )?.taskId ?? twinTaskId;
          } else {
            const phase = await tx.projectPhase.create({
              data: {
                projectId: project.id,
                name: phaseName,
                orderIndex: nextOrderIndex++,
                startDate,
                endDate,
                status: PhaseStatus.Planned,
                description: scheduleFields.description,
              },
            });
            phaseId = phase.id;
            summaryUidToPhaseId.set(summary.uid, phase.id);
            phaseByName.set(phaseName.toLowerCase(), {
              id: phase.id,
              orderIndex: phase.orderIndex,
              name: phase.name,
              taskId: null,
            });
            phasesCreated += 1;
            twinTaskId = null;
          }

          // Upsert schedule twin (holds duration, %, phase→phase deps, assignees).
          if (twinTaskId) {
            await tx.task.update({
              where: { id: twinTaskId },
              data: {
                title: scheduleFields.title,
                description: scheduleFields.description,
                startDate: scheduleFields.startDate ?? startDate,
                endDate: scheduleFields.endDate ?? endDate,
                baselineStart: scheduleFields.baselineStart ?? null,
                baselineEnd: scheduleFields.baselineEnd ?? null,
                durationDays: scheduleFields.durationDays ?? null,
                baselineDurationDays: scheduleFields.baselineDurationDays ?? null,
                effortHours: scheduleFields.effortHours ?? null,
                progressApproved: scheduleFields.progressApproved,
                status: scheduleFields.status,
                priority: scheduleFields.priority,
                mspTaskMode: scheduleFields.mspTaskMode ?? null,
                mspConstraintType: scheduleFields.mspConstraintType ?? null,
                mspConstraintDate: scheduleFields.mspConstraintDate ?? null,
                mspCustomFields:
                  scheduleFields.mspCustomFields != null
                    ? (scheduleFields.mspCustomFields as unknown as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                phase: { connect: { id: phaseId } },
                parentTask: { disconnect: true },
              },
            });
            uidToTaskId.set(summary.uid, twinTaskId);
            phaseTwinIds.add(twinTaskId);
          } else {
            const twin = await tx.task.create({
              data: {
                project: { connect: { id: project.id } },
                phase: { connect: { id: phaseId } },
                title: scheduleFields.title,
                description: scheduleFields.description,
                startDate: scheduleFields.startDate ?? startDate,
                endDate: scheduleFields.endDate ?? endDate,
                baselineStart: scheduleFields.baselineStart ?? null,
                baselineEnd: scheduleFields.baselineEnd ?? null,
                durationDays: scheduleFields.durationDays ?? null,
                baselineDurationDays: scheduleFields.baselineDurationDays ?? null,
                effortHours: scheduleFields.effortHours ?? null,
                progressApproved: scheduleFields.progressApproved,
                status: scheduleFields.status,
                mspCustomFields:
                  scheduleFields.mspCustomFields != null
                    ? (scheduleFields.mspCustomFields as unknown as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                priority: scheduleFields.priority,
                mspTaskMode: scheduleFields.mspTaskMode ?? null,
                mspConstraintType: scheduleFields.mspConstraintType ?? null,
                mspConstraintDate: scheduleFields.mspConstraintDate ?? null,
              },
            });
            await tx.projectPhase.update({
              where: { id: phaseId },
              data: { taskId: twin.id },
            });
            uidToTaskId.set(summary.uid, twin.id);
            phaseTwinIds.add(twin.id);
            const entry = phaseByName.get(phaseName.toLowerCase());
            if (entry) {
              (entry as { taskId?: string | null }).taskId = twin.id;
            }
            tasksCreated += 1;
          }
        }

        if (phasesCreated > 0 || phasesUpdated > 0) {
          warnings.push(
            `Phases from summary rows: ${phasesCreated} created, ${phasesUpdated} updated (with schedule twins).`,
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
            tz,
          );
          defaultPhaseId = defaultPhase.id;
          if (defaultPhase.created) {
            phasesCreated += 1;
          }
        }

        const existingTasks = await tx.task.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            phaseId: true,
            parentTaskId: true,
            status: true,
            progressApproved: true,
          },
        });
        // Match by title + phase + parent; consume each match once so duplicates
        // under different parents (e.g. two "Defining Schema") create/update correctly.
        // Exclude phase schedule twins so they are not treated as work tasks.
        const existingTaskByKey = new Map<
          string,
          {
            id: string;
            status: TaskStatus;
            progressApproved: number | null;
          }
        >();
        for (const existing of existingTasks) {
          if (!existing.phaseId || phaseTwinIds.has(existing.id)) {
            continue;
          }
          const parentKey = this.normalizeMatchParentId(
            existing.parentTaskId,
            phaseTwinIds,
          );
          const key = this.taskMatchKey(
            existing.title,
            existing.phaseId,
            parentKey,
          );
          if (!existingTaskByKey.has(key)) {
            existingTaskByKey.set(key, {
              id: existing.id,
              status: existing.status,
              progressApproved: existing.progressApproved,
            });
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

            const parentKey = this.normalizeMatchParentId(
              parentTaskId,
              phaseTwinIds,
            );
            const matchKey = this.taskMatchKey(task.name, phaseId, parentKey);
            const existingMatch = existingTaskByKey.get(matchKey);

            if (existingMatch) {
              await tx.task.update({
                where: { id: existingMatch.id },
                data: this.toTaskUpdateInput(
                  phaseId,
                  task,
                  parentTaskId,
                  tz,
                  existingMatch,
                ),
              });
              uidToTaskId.set(task.uid, existingMatch.id);
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
                  tz,
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

        const milestoneResult = await this.importMppMilestones(
          tx,
          projectId,
          milestoneTasks,
          summaryUidToPhaseId,
          defaultPhaseId,
          byUid,
          uidToTaskId,
          tz,
        );
        milestonesCreated += milestoneResult.created;
        milestonesUpdated += milestoneResult.updated;
        warnings.push(...milestoneResult.warnings);
        if (milestonesCreated > 0 || milestonesUpdated > 0) {
          warnings.push(
            `Milestones from MPP: ${milestonesCreated} created, ${milestonesUpdated} updated.`,
          );
        }

        // Replace predecessors from the file: upsert file links, then remove stale
        // deps whose successor was part of this import (keeps PMO aligned with MPP).
        const desiredDepKeys = new Set<string>();
        const importedTaskIds = new Set(uidToTaskId.values());
        const linkRows = [...importableTasks, ...phaseSummaries];
        for (const task of linkRows) {
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
            desiredDepKeys.add(`${predecessorId}|${successorId}`);
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

        if (importedTaskIds.size > 0) {
          const staleDeps = await tx.taskDependency.findMany({
            where: {
              successorId: { in: [...importedTaskIds] },
            },
            select: { id: true, predecessorId: true, successorId: true },
          });
          let dependenciesRemoved = 0;
          for (const dep of staleDeps) {
            const key = `${dep.predecessorId}|${dep.successorId}`;
            if (desiredDepKeys.has(key)) continue;
            await tx.taskDependency.delete({ where: { id: dep.id } });
            dependenciesRemoved += 1;
          }
          if (dependenciesRemoved > 0) {
            warnings.push(
              `Removed ${dependenciesRemoved} predecessor link(s) not present in the import file.`,
            );
          }
        }

        const assignmentApply = await this.applyResourceAssignments(
          tx,
          parsed,
          uidToTaskId,
          new Set(milestoneTasks.map((task) => task.uid)),
        );
        warnings.push(...assignmentApply.warnings);
        resourceMatchForResult = {
          matched: assignmentApply.resourcesMatched,
          unmatched: assignmentApply.resourcesUnmatched,
          warnings: assignmentApply.warnings,
        };
        assignmentsApplied = assignmentApply.assignmentsApplied;
        assignmentsSkipped = assignmentApply.assignmentsSkipped;

        await renumberProjectPlanRows(tx, projectId);
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
   * Top-level phase summaries become ProjectPhase rows.
   * Nested summaries become parent tasks under their phase (hierarchy preserved).
   * A single L1 row that wraps Phase 1/2/3 (the MS Project plan name) is not a phase.
   */
  private getTopLevelPhaseSummaries(
    allTasks: ParsedMppTask[],
    byUid: Map<number, ParsedMppTask>,
  ): ParsedMppTask[] {
    return allTasks.filter((task) => this.isTopLevelPhaseSummary(task, byUid));
  }

  /**
   * MS Project often has: [optional outline 0] → plan name (L1) → Phase 1/2/3 (L2).
   * That L1 row is the project, not a Cybsec phase.
   * Detect with ≥1 phase child (single-phase plans included).
   */
  private getScheduleWrapperSummary(
    byUid: Map<number, ParsedMppTask>,
  ): ParsedMppTask | undefined {
    const allTasks = [...byUid.values()];
    const l1 = allTasks.filter(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.outlineLevel === 1,
    );
    if (l1.length !== 1) {
      return undefined;
    }
    const wrapper = l1[0];
    const direct = allTasks.filter(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.uid !== wrapper.uid &&
        task.parentUid === wrapper.uid,
    );
    const atNextLevel = allTasks.filter(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.outlineLevel === 2 &&
        (task.parentUid === wrapper.uid ||
          this.isDescendantOf(task, wrapper.uid, byUid)),
    );
    const phaseRows = direct.length > 0 ? direct : atNextLevel;
    return phaseRows.length >= 1 ? wrapper : undefined;
  }

  private isDescendantOf(
    task: ParsedMppTask,
    ancestorUid: number,
    byUid: Map<number, ParsedMppTask>,
  ): boolean {
    let uid = task.parentUid;
    const visited = new Set<number>();
    while (uid != null && !visited.has(uid)) {
      if (uid === ancestorUid) return true;
      visited.add(uid);
      uid = byUid.get(uid)?.parentUid;
    }
    return false;
  }

  private isScheduleWrapperSummary(
    task: ParsedMppTask,
    byUid: Map<number, ParsedMppTask>,
  ): boolean {
    const wrapper = this.getScheduleWrapperSummary(byUid);
    return wrapper != null && wrapper.uid === task.uid;
  }

  /** Match an existing Cybsec project by exact plan name (case-sensitive, trim only). */
  private findExistingProjectByName(
    existingProjects: { id: string; name: string }[],
    ...names: Array<string | undefined>
  ): { id: string; name: string } | undefined {
    const keys = new Set(
      names
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    );
    if (keys.size === 0) return undefined;
    return existingProjects.find((project) => keys.has(project.name.trim()));
  }

  /**
   * Cybsec project name = the plan row you see in MS Project (top summary),
   * not File properties / Project Title (often the .mpp file name).
   */
  private resolveVisibleProjectName(
    parsed: ParsedMppProject,
    byUid: Map<number, ParsedMppTask>,
  ): string | undefined {
    const wrapper = this.getScheduleWrapperSummary(byUid);
    if (wrapper?.name?.trim()) {
      return wrapper.name.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
    }

    const outlineZero = [...byUid.values()].find(
      (task) =>
        task.summary &&
        Boolean(task.name?.trim()) &&
        task.outlineLevel === 0,
    );
    if (outlineZero?.name?.trim()) {
      return outlineZero.name.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
    }

    return parsed.project?.name?.trim() || undefined;
  }

  /** Leaves, nested summaries, and milestones (not project root, wrapper, or phases). */
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
    if (this.isScheduleWrapperSummary(task, byUid)) {
      return false;
    }
    if (this.isTopLevelPhaseSummary(task, byUid)) {
      return false;
    }
    return true;
  }

  /**
   * MS Project milestones: only the explicit Milestone flag on a leaf row.
   * Do not infer from missing/zero duration — that over-tags normal tasks
   * on export→re-import when durationDays is weak/null.
   */
  private isMppMilestone(
    task: ParsedMppTask,
    hasMilestoneFlagDef = false,
  ): boolean {
    if (!task.name?.trim() || task.summary || task.outlineLevel === 0) {
      return false;
    }
    const hasFlag1 =
      Array.isArray(task.customFields) &&
      task.customFields.some((entry) => {
        const key = (entry?.fieldName || '').trim().toLowerCase();
        if (key === 'flag1' || key === 'ismilestone') {
          const val = String(entry?.value ?? '').trim().toLowerCase();
          return val === '1' || val === 'true' || val === 'yes';
        }
        return false;
      });

    if (hasFlag1) {
      return true;
    }
    // If the file explicitly defines Flag1 / IsMilestone (exported from Cybsec PMO),
    // only rows with Flag1=1 are genuine milestones. This prevents tasks that MS Project
    // auto-collapsed to 0 days from becoming unwanted milestones.
    if (hasMilestoneFlagDef) {
      return false;
    }
    return Boolean(task.milestone);
  }

  private getMppMilestoneTasks(
    allTasks: ParsedMppTask[],
    hasMilestoneFlagDef = false,
  ): ParsedMppTask[] {
    return allTasks.filter((task) => this.isMppMilestone(task, hasMilestoneFlagDef));
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

    const wrapper = this.getScheduleWrapperSummary(byUid);
    if (wrapper && wrapper.uid === task.uid) {
      return false;
    }

    // Plan-name wrapper: its direct summary children (Phase 1/2/3) are the phases.
    if (wrapper) {
      if (task.parentUid === wrapper.uid) {
        return true;
      }
      if (
        task.parentUid == null &&
        task.outlineLevel === (wrapper.outlineLevel ?? 1) + 1
      ) {
        return true;
      }
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
    timeZone?: string,
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
      this.parseDate(parsed.project?.startDate, timeZone) ?? project.startDate;
    const endDate =
      this.parseDate(parsed.project?.finishDate, timeZone) ?? project.endDate;

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

    const twin = await tx.task.create({
      data: {
        project: { connect: { id: project.id } },
        phase: { connect: { id: phase.id } },
        title: DEFAULT_PHASE_NAME,
        startDate,
        endDate,
        priority: PriorityLevel.Medium,
        status: TaskStatus.To_Do,
        progressApproved: 0,
      },
    });
    await tx.projectPhase.update({
      where: { id: phase.id },
      data: { taskId: twin.id },
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
    uidToTaskId: Map<number, string>,
    timeZone?: string,
  ): Promise<{ created: number; updated: number; warnings: string[] }> {
    if (milestoneTasks.length === 0) {
      return { created: 0, updated: 0, warnings: [] };
    }

    const existing = await tx.projectMilestone.findMany({
      where: { projectId },
      select: { id: true, title: true, phaseId: true, taskId: true },
    });
    const existingByKey = new Map<string, string>();
    const existingByTaskId = new Map<string, string>();
    for (const row of existing) {
      const key = this.milestoneMatchKey(row.title, row.phaseId);
      if (!existingByKey.has(key)) {
        existingByKey.set(key, row.id);
      }
      if (row.taskId && !existingByTaskId.has(row.taskId)) {
        existingByTaskId.set(row.taskId, row.id);
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
        this.parseDate(ms.finishDate, timeZone) ??
        this.parseDate(ms.startDate, timeZone) ??
        new Date();

      const status = this.resolveMppMilestoneStatus(ms);
      const taskId = uidToTaskId.get(ms.uid) ?? null;
      const key = this.milestoneMatchKey(title, phaseId);
      const existingId =
        (taskId ? existingByTaskId.get(taskId) : undefined) ??
        existingByKey.get(key);

      if (existingId) {
        await tx.projectMilestone.update({
          where: { id: existingId },
          data: { targetDate, phaseId, status, taskId },
        });
        updated += 1;
        if (taskId) {
          existingByTaskId.set(taskId, existingId);
        }
      } else {
        const row = await tx.projectMilestone.create({
          data: {
            projectId,
            title,
            targetDate,
            phaseId,
            status,
            weight: null,
            taskId,
          },
        });
        existingByKey.set(key, row.id);
        if (taskId) {
          existingByTaskId.set(taskId, row.id);
        }
        created += 1;
      }
    }

    return { created, updated, warnings };
  }

  /**
   * Match key for re-import. Parent is included so same titles under different
   * summaries (Admin Console vs Policy Manager) do not collide.
   * Phase schedule twins count as "no parent" (top-level under the phase).
   */
  private taskMatchKey(
    title: string,
    phaseId: string,
    parentTaskId?: string | null,
  ): string {
    const parent = parentTaskId?.trim() || '';
    return `${phaseId}|${parent}|${title.trim().toLowerCase()}`;
  }

  private normalizeMatchParentId(
    parentTaskId: string | null | undefined,
    phaseTwinIds: Set<string>,
  ): string | null {
    if (!parentTaskId) return null;
    if (phaseTwinIds.has(parentTaskId)) return null;
    return parentTaskId;
  }

  private taskScheduleFields(task: ParsedMppTask, timeZone?: string): {
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
    priority: PriorityLevel;
    mspTaskMode: string | undefined;
    mspConstraintType: string | undefined;
    mspConstraintDate: Date | undefined;
    mspCustomFields: Record<string, string> | undefined;
  } {
    const progress = Math.max(0, Math.min(100, task.percentComplete ?? 0));
    const status =
      progress >= 100
        ? TaskStatus.Done
        : progress > 0
          ? TaskStatus.In_Progress
          : TaskStatus.To_Do;

    const startDate = this.parseDate(task.startDate, timeZone);
    const endDate = this.parseDate(task.finishDate, timeZone);
    const baselineStart = this.parseDate(task.baselineStartDate, timeZone);
    const baselineEnd = this.parseDate(task.baselineFinishDate, timeZone);
    const actualStart = this.parseDate(task.actualStartDate, timeZone);
    const actualEnd = this.parseDate(task.actualFinishDate, timeZone);

    const durationDays = this.normalizeDurationDays(task.durationDays);
    const baselineDurationDays = this.normalizeDurationDays(
      task.baselineDurationDays,
    );

    const effortFromWork = this.normalizeEffortHours(task.workHours);
    const effortFromDuration =
      durationDays != null && durationDays > 0
        ? Math.max(1, Math.round(durationDays * 8))
        : undefined;

    // MSP Notes only → Task.description. Do not invent WBS/other text as Notes.
    const notes = task.notes?.trim();
    const description = notes ? notes.slice(0, 8000) : undefined;

    return {
      title: task.name.slice(0, 255),
      description,
      startDate,
      endDate,
      // Only store true MSP baselines; do not copy current dates as baseline.
      baselineStart,
      baselineEnd,
      actualStart,
      actualEnd,
      durationDays,
      baselineDurationDays,
      effortHours: effortFromWork ?? effortFromDuration,
      progressApproved: progress,
      status,
      priority: this.mapMspPriorityToLevel(task.priority),
      mspTaskMode: this.normalizeTaskMode(task.taskMode),
      mspConstraintType: this.normalizeConstraintType(task.constraintType),
      mspConstraintDate: this.constraintDateForType(
        task.constraintType,
        this.parseDate(task.constraintDate, timeZone),
      ),
      mspCustomFields: this.toMspCustomFieldsMap(task.customFields),
    };
  }

  private normalizeTaskMode(value?: string | null): string {
    if (value && value.trim().toLowerCase() === 'auto') return 'Auto';
    return 'Manual';
  }

  private normalizeConstraintType(value?: string | null): string {
    const code = (value || 'ASAP').trim().toUpperCase();
    switch (code) {
      case 'ASAP':
      case 'ALAP':
      case 'SNET':
      case 'FNET':
      case 'SNLT':
      case 'FNLT':
      case 'MSO':
      case 'MFO':
        return code;
      case 'AS_SOON_AS_POSSIBLE':
        return 'ASAP';
      case 'AS_LATE_AS_POSSIBLE':
        return 'ALAP';
      case 'MUST_START_ON':
        return 'MSO';
      case 'MUST_FINISH_ON':
        return 'MFO';
      case 'START_NO_EARLIER_THAN':
        return 'SNET';
      case 'START_NO_LATER_THAN':
        return 'SNLT';
      case 'FINISH_NO_EARLIER_THAN':
        return 'FNET';
      case 'FINISH_NO_LATER_THAN':
        return 'FNLT';
      default:
        return 'ASAP';
    }
  }

  private constraintDateForType(
    type?: string | null,
    date?: Date,
  ): Date | undefined {
    const code = this.normalizeConstraintType(type);
    if (code === 'ASAP' || code === 'ALAP') return undefined;
    return date;
  }

  /**
   * Inverse of export mapPriority (Critical=1000, High=700, Medium=500, Low=300).
   * Midpoints keep re-import stable after export.
   */
  private mapMspPriorityToLevel(value?: number | null): PriorityLevel {
    if (value == null || !Number.isFinite(Number(value))) {
      return PriorityLevel.Medium;
    }
    const n = Math.max(0, Math.min(1000, Math.round(Number(value))));
    if (n >= 850) return PriorityLevel.Critical;
    if (n >= 600) return PriorityLevel.High;
    if (n >= 400) return PriorityLevel.Medium;
    return PriorityLevel.Low;
  }

  /** Non-empty custom field values → JSON map keyed by Text1 / Flag2 / …. */
  private toMspCustomFieldsMap(
    values?: { fieldName?: string; value?: string }[] | null,
  ): Record<string, string> | undefined {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    const map: Record<string, string> = {};
    for (const entry of values) {
      const key = entry?.fieldName?.trim();
      const value = entry?.value?.trim();
      if (!key || !value) continue;
      map[key] = value.slice(0, 4000);
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }

  private normalizeCustomFieldDefs(
    defs?: ParsedMppProject['customFieldDefs'],
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!Array.isArray(defs) || defs.length === 0) {
      return Prisma.JsonNull;
    }
    const cleaned = defs
      .filter((d) => d?.fieldName?.trim())
      .map((d) => ({
        fieldName: d.fieldName.trim(),
        index: d.index ?? undefined,
        type: d.type?.trim() || undefined,
        alias: d.alias?.trim() || undefined,
        fieldId: d.fieldId?.trim() || undefined,
      }));
    return cleaned.length > 0
      ? (cleaned as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  private normalizeDurationDays(value?: number | null): number | undefined {
    // 0 is valid (MSP milestones / summary baseline duration); only reject null/NaN/negative.
    if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) {
      return undefined;
    }
    return Math.round(Number(value) * 10) / 10;
  }

  private normalizeEffortHours(value?: number | null): number | undefined {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      return undefined;
    }
    return Math.max(1, Math.round(Number(value)));
  }

  private async applyProjectScheduleFromParsed(
    tx: Prisma.TransactionClient,
    projectId: string,
    parsed: ParsedMppProject,
    timeZone?: string,
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

    const startDate = this.parseDate(props.startDate, timeZone);
    const endDate = this.parseDate(props.finishDate, timeZone);
    const baselineStartDate = this.parseDate(props.baselineStartDate, timeZone);
    const baselineEndDate = this.parseDate(props.baselineFinishDate, timeZone);
    const actualStartDate = this.parseDate(props.actualStartDate, timeZone);
    const actualEndDate = this.parseDate(props.actualFinishDate, timeZone);
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

    data.mspCustomFieldDefs = this.normalizeCustomFieldDefs(
      parsed.customFieldDefs,
    );

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
    timeZone?: string,
  ): Prisma.TaskCreateInput {
    const fields = this.taskScheduleFields(task, timeZone);

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
      priority: fields.priority,
      mspTaskMode: fields.mspTaskMode ?? null,
      mspConstraintType: fields.mspConstraintType ?? null,
      mspConstraintDate: fields.mspConstraintDate ?? null,
      mspCustomFields:
        fields.mspCustomFields != null
          ? (fields.mspCustomFields as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      ...(createdAt ? { createdAt } : {}),
    };
  }

  private toTaskUpdateInput(
    phaseId: string,
    task: ParsedMppTask,
    parentTaskId?: string,
    timeZone?: string,
    existing?: {
      status: TaskStatus;
      progressApproved: number | null;
    },
  ): Prisma.TaskUpdateInput {
    const fields = this.taskScheduleFields(task, timeZone);
    const existingProgress = Number(existing?.progressApproved ?? 0);
    // Never wipe approved progress with a lower MPP % on re-import.
    const progressApproved = Math.max(existingProgress, fields.progressApproved);
    // Preserve execution status (e.g. In_Progress) when MPP % is still 0 → To_Do.
    const status = this.resolveStatusOnReimport(
      existing?.status,
      fields.status,
      fields.progressApproved,
    );

    const data: Prisma.TaskUpdateInput = {
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
      progressApproved,
      status,
      priority: fields.priority,
      mspTaskMode: fields.mspTaskMode ?? null,
      mspConstraintType: fields.mspConstraintType ?? null,
      mspConstraintDate: fields.mspConstraintDate ?? null,
    };

    // Only write duration/effort when MPP provided values — do not null them out.
    if (fields.durationDays != null) {
      data.durationDays = fields.durationDays;
    }
    if (fields.baselineDurationDays != null) {
      data.baselineDurationDays = fields.baselineDurationDays;
    }
    if (fields.effortHours != null) {
      data.effortHours = fields.effortHours;
    }
    // Replace custom fields from this MPP (empty → clear).
    data.mspCustomFields =
      fields.mspCustomFields != null
        ? (fields.mspCustomFields as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    return data;
  }

  /**
   * Re-import must not reset In_Progress/Done/etc. to To_Do solely because the
   * MPP still has 0% complete (TC-M1.8-04 / DEF-P1-045).
   */
  private resolveStatusOnReimport(
    existing: TaskStatus | undefined,
    fromMpp: TaskStatus,
    mppPercent: number,
  ): TaskStatus {
    if (!existing) return fromMpp;
    if (mppPercent >= 100) return TaskStatus.Done;
    if (fromMpp === TaskStatus.Done) return TaskStatus.Done;
    if (
      existing !== TaskStatus.To_Do &&
      fromMpp === TaskStatus.To_Do &&
      mppPercent <= 0
    ) {
      return existing;
    }
    if (
      existing === TaskStatus.To_Do &&
      mppPercent > 0 &&
      mppPercent < 100
    ) {
      return TaskStatus.In_Progress;
    }
    return existing;
  }

  private parseDate(value?: string, timeZone?: string): Date | undefined {
    return fromMspdiDateTime(value, timeZone);
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

    // Parent is project root, plan-name wrapper, or a phase — no parent task row.
    if (
      parent.outlineLevel === 0 ||
      this.isScheduleWrapperSummary(parent, byUid) ||
      this.isTopLevelPhaseSummary(parent, byUid)
    ) {
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
   * a Cybsec user. Persist the original Resource Names cell on each task
   * (matched + unmatched) so export can round-trip names like NES Customer.
   * Milestone schedule rows keep the names but stay unassigned.
   */
  private async applyResourceAssignments(
    tx: Prisma.TransactionClient,
    parsed: ParsedMppProject,
    uidToTaskId: Map<number, string>,
    skipTaskUids: Set<number> = new Set(),
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
      names: string[];
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

      const acc = byTaskId.get(taskId) ?? { userIds: [], names: [] };
      const displayName = resource.name.trim();
      if (!acc.names.some((name) => name.toLowerCase() === displayName.toLowerCase())) {
        acc.names.push(displayName);
      }

      const isMilestoneRow = skipTaskUids.has(assignment.taskUid);
      const userId = userByResourceUid.get(resource.uid);
      if (!isMilestoneRow && userId && !acc.userIds.includes(userId)) {
        acc.userIds.push(userId);
        assignmentsApplied += 1;
      }

      byTaskId.set(taskId, acc);
    }

    for (const [uid, taskId] of uidToTaskId.entries()) {
      const acc = byTaskId.get(taskId);
      const resourceNames = joinResourceNames(acc?.names ?? []);
      const isMilestoneRow = skipTaskUids.has(uid);
      if (isMilestoneRow) {
        await tx.task.update({
          where: { id: taskId },
          data: {
            resourceNames,
            ownerId: null,
            backupOwnerId: null,
          },
        });
        continue;
      }
      const ownerId = acc?.userIds[0] ?? null;
      const backupOwnerId = acc?.userIds[1] ?? null;
      await tx.task.update({
        where: { id: taskId },
        data: {
          resourceNames,
          // Keep a Cybsec assignee (e.g. Emily) when the file has no matched users.
          ...(ownerId
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
  }): Promise<{ id: string; displayName?: string } | null> {
    const email = resource.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true, displayName: true },
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
      select: { id: true, displayName: true },
    });
    return byName;
  }

  /** "Vinayak Sonkavada (CyberKnight)" → "Vinayak Sonkavada" */
  private stripResourceOrganization(name: string): string {
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
  }
}
