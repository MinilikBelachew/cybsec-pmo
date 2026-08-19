/**
 * Port of frontend Import Tasks row parsing / validation
 * (processRawTaskCSVRows + revalidateParsedTaskRow).
 */

export type PreviewPhase = {
  id: string;
  name: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
};

export type PreviewAssignee = {
  userId: string;
  displayName: string;
  email: string;
  name: string;
};

export type PreviewExistingTask = {
  id: string;
  title: string;
  parentTitle?: string | null;
};

export type ParsedExcelPredecessor = {
  title: string;
  depType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays: number;
};

export type ExcelTaskPreviewRow = {
  title: string;
  description: string;
  priority: string;
  status: string;
  assigneeName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  effortHours: number;
  durationDays?: number;
  baselineStart?: string;
  baselineEnd?: string;
  baselineDurationDays?: number;
  actualStart?: string;
  actualEnd?: string;
  progressApproved?: number;
  predecessors?: ParsedExcelPredecessor[];
  /** Excel "Parent Task" title. Undefined when the column is absent. */
  parentTaskTitle?: string;
  resolvedAssigneeId?: string | null;
  resolvedPhaseId?: string | null;
  importMode: 'create' | 'update';
  resolvedTaskId?: string;
  errors: string[];
  warnings: string[];
  isSummary?: boolean;
  isMilestone?: boolean;
};

export type TaskCsvImportKind = 'tasks' | 'projects' | 'unknown';

export function detectTaskCsvImportKind(csvData: string[][]): TaskCsvImportKind {
  if (csvData.length === 0) return 'unknown';

  const headers = csvData[0].map((h) => h.toLowerCase().trim());
  const has = (aliases: string[]) =>
    aliases.some((alias) =>
      headers.some((header) => header === alias || header.includes(alias)),
    );

  const looksLikeProjects =
    has(['department', 'dept']) &&
    has(['customer', 'client']) &&
    (has(['objective']) || has(['engagement type', 'engagement']));

  const looksLikeTasks =
    has(['title', 'task title', 'task name']) ||
    (has(['effort hours', 'effort', 'hours']) &&
      (has(['assignee', 'owner']) ||
        has(['phase', 'project phase', 'stage'])));

  if (looksLikeProjects && !looksLikeTasks) return 'projects';
  if (looksLikeTasks) return 'tasks';
  return 'unknown';
}

export function processRawTaskRows(
  csvData: string[][],
  phases: PreviewPhase[],
  assignees: PreviewAssignee[],
  existingTasks?: PreviewExistingTask[],
): ExcelTaskPreviewRow[] {
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);
  const claimedExistingIds = new Set<string>();

  const getIndex = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h.trim()));

  const titleIdx = getIndex(['title', 'task title', 'task name']);
  const descIdx = getIndex(['description', 'desc', 'details', 'objective']);
  const prioIdx = getIndex(['priority', 'priority level']);
  const statusIdx = getIndex(['status', 'task status']);
  const assigneeIdx = getIndex(['assignee', 'owner', 'pm']);
  const phaseIdx = getIndex(['phase', 'project phase', 'stage']);
  const startIdx = getIndex(['start date', 'start']);
  const endIdx = getIndex(['end date', 'end']);
  const effortIdx = getIndex([
    'effort hours',
    'effort',
    'hours',
    'working hours',
    'work hours',
  ]);
  const durationIdx = getIndex(['duration days']);
  const baselineStartIdx = getIndex(['baseline start', 'baseline start date']);
  const baselineEndIdx = getIndex([
    'baseline end',
    'baseline finish',
    'baseline end date',
  ]);
  const baselineDurationIdx = getIndex([
    'baseline duration days',
    'baseline duration',
  ]);
  const actualStartIdx = getIndex(['actual start', 'actual start date']);
  const actualEndIdx = getIndex([
    'actual end',
    'actual finish',
    'actual end date',
    'actual finish date',
  ]);
  const progressIdx = getIndex([
    '% complete',
    'percent complete',
    '%complete',
    'progress',
    'progress approved',
  ]);
  const predecessorsIdx = getIndex(['predecessors', 'predecessor', 'preds']);
  const parentIdx = getIndex([
    'parent task',
    'parent task title',
    'parent title',
    'parent',
  ]);

  const parseOptionalNumber = (raw: string): number | undefined => {
    if (!raw) return undefined;
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const parsed = rows.map((row) => {
    const getVal = (idx: number, fallback = '') =>
      idx !== -1 && row[idx] ? row[idx].trim() : fallback;

    const title = getVal(titleIdx);
    const description = getVal(descIdx);
    const priority = getVal(prioIdx, 'Medium');
    const status = getVal(statusIdx, 'To_Do');
    const assigneeName = getVal(assigneeIdx);
    const phaseName = getVal(phaseIdx);
    const startDate = getVal(startIdx);
    const endDate = getVal(endIdx);
    const rawEffort = getVal(effortIdx, '0');

    let effortHours = 0;
    if (rawEffort) {
      const parsedEffort = parseFloat(rawEffort.replace(/[^0-9.-]/g, ''));
      effortHours = Number.isNaN(parsedEffort) ? NaN : parsedEffort;
    }

    const durationDays = parseOptionalNumber(getVal(durationIdx));
    const baselineDurationDays = parseOptionalNumber(
      getVal(baselineDurationIdx),
    );
    const progressApproved = parseOptionalNumber(getVal(progressIdx));
    const baselineStart = getVal(baselineStartIdx) || undefined;
    const baselineEnd = getVal(baselineEndIdx) || undefined;
    const actualStart = getVal(actualStartIdx) || undefined;
    const actualEnd = getVal(actualEndIdx) || undefined;
    const predecessors = parsePredecessorsCell(getVal(predecessorsIdx));
    const parentTaskTitle =
      parentIdx === -1 ? undefined : getVal(parentIdx);

    return revalidateParsedTaskRow(
      {
        title,
        description,
        priority,
        status,
        assigneeName,
        phaseName,
        startDate,
        endDate,
        effortHours,
        durationDays,
        baselineStart,
        baselineEnd,
        baselineDurationDays,
        actualStart,
        actualEnd,
        progressApproved,
        predecessors,
        parentTaskTitle,
        importMode: 'create',
        errors: [],
        warnings: [],
      },
      phases,
      assignees,
      undefined,
      existingTasks,
      claimedExistingIds,
    );
  });

  return annotateParentTaskWarnings(
    markExtraSameParentTitleRows(parsed),
    existingTasks,
  );
}

export function revalidateParsedTaskRow(
  row: ExcelTaskPreviewRow,
  phases: PreviewPhase[],
  assignees: PreviewAssignee[],
  _duplicateTitles?: Set<string>,
  existingTasks?: PreviewExistingTask[],
  claimedExistingIds?: Set<string>,
): ExcelTaskPreviewRow {
  const updated = {
    ...row,
    priority: normalizeTaskPriority(row.priority),
    status: normalizeTaskStatus(row.status),
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!updated.title) errors.push('Task title is required.');

  const { importMode, resolvedTaskId } = existingTasks
    ? resolveTaskImportMatch(
        updated.title,
        updated.parentTaskTitle,
        existingTasks,
        claimedExistingIds,
      )
    : {
        importMode: updated.importMode,
        resolvedTaskId: updated.resolvedTaskId,
      };

  let isStartValid = false;
  let normalizedStart = '';
  if (updated.startDate) {
    const startKey = toTaskDayKey(updated.startDate);
    if (startKey) {
      isStartValid = true;
      normalizedStart = startKey;
    } else {
      errors.push('Start date must be a valid date (YYYY-MM-DD).');
    }
  }

  let isEndValid = false;
  let normalizedEnd = '';
  if (updated.endDate) {
    const endKey = toTaskDayKey(updated.endDate);
    if (endKey) {
      isEndValid = true;
      normalizedEnd = endKey;
    } else {
      errors.push('End date must be a valid date (YYYY-MM-DD).');
    }
  }

  if (isStartValid && isEndValid && normalizedStart && normalizedEnd) {
    if (normalizedStart > normalizedEnd) {
      errors.push('End date must be on or after start date.');
    }
  }

  if (updated.effortHours != null && Number.isNaN(Number(updated.effortHours))) {
    errors.push('Invalid effort hours.');
  }

  if (
    updated.durationDays != null &&
    (!Number.isFinite(Number(updated.durationDays)) ||
      Number(updated.durationDays) <= 0)
  ) {
    errors.push('Invalid duration days.');
  }

  if (
    updated.baselineDurationDays != null &&
    (!Number.isFinite(Number(updated.baselineDurationDays)) ||
      Number(updated.baselineDurationDays) <= 0)
  ) {
    errors.push('Invalid baseline duration days.');
  }

  if (
    updated.progressApproved != null &&
    (!Number.isFinite(Number(updated.progressApproved)) ||
      Number(updated.progressApproved) < 0 ||
      Number(updated.progressApproved) > 100)
  ) {
    errors.push('% Complete must be between 0 and 100.');
  }

  let normalizedBaselineStart = updated.baselineStart || '';
  if (updated.baselineStart) {
    const key = toTaskDayKey(updated.baselineStart);
    if (key) {
      normalizedBaselineStart = key;
    } else {
      errors.push('Baseline start must be a valid date (YYYY-MM-DD).');
    }
  }

  let normalizedBaselineEnd = updated.baselineEnd || '';
  if (updated.baselineEnd) {
    const key = toTaskDayKey(updated.baselineEnd);
    if (key) {
      normalizedBaselineEnd = key;
    } else {
      errors.push('Baseline end must be a valid date (YYYY-MM-DD).');
    }
  }

  let normalizedActualStart = updated.actualStart || '';
  if (updated.actualStart) {
    const key = toTaskDayKey(updated.actualStart);
    if (key) {
      normalizedActualStart = key;
    } else {
      errors.push('Actual start must be a valid date (YYYY-MM-DD).');
    }
  }

  let normalizedActualEnd = updated.actualEnd || '';
  if (updated.actualEnd) {
    const key = toTaskDayKey(updated.actualEnd);
    if (key) {
      normalizedActualEnd = key;
    } else {
      errors.push('Actual end must be a valid date (YYYY-MM-DD).');
    }
  }

  if (
    normalizedBaselineStart &&
    normalizedBaselineEnd &&
    normalizedBaselineStart > normalizedBaselineEnd
  ) {
    errors.push('Baseline end must be on or after baseline start.');
  }

  if (
    normalizedActualStart &&
    normalizedActualEnd &&
    normalizedActualStart > normalizedActualEnd
  ) {
    errors.push('Actual end must be on or after actual start.');
  }

  let resolvedAssigneeId = updated.resolvedAssigneeId ?? null;
  if (resolvedAssigneeId) {
    const assigneeExists = assignees.some(
      (assignee) => assignee.userId === resolvedAssigneeId,
    );
    if (!assigneeExists) resolvedAssigneeId = null;
  } else if (updated.assigneeName) {
    const assignee = findProjectTaskAssignee(updated.assigneeName, assignees);
    if (assignee) {
      resolvedAssigneeId = assignee.userId;
    } else if (assignees.length === 0) {
      warnings.push(
        `Assignee "${updated.assigneeName}" will be skipped until they are on the project team.`,
      );
    } else {
      errors.push(
        `Assignee "${updated.assigneeName}" is not on the project team. Add them to the team first.`,
      );
    }
  }

  let resolvedPhaseId = updated.resolvedPhaseId ?? null;
  let phaseName = updated.phaseName;
  let resolvedPhase: PreviewPhase | undefined;
  if (resolvedPhaseId) {
    resolvedPhase = phases.find((item) => item.id === resolvedPhaseId);
    if (resolvedPhase) {
      phaseName = resolvedPhase.name;
    } else {
      resolvedPhaseId = null;
    }
  }

  if (!resolvedPhaseId && phaseName) {
    resolvedPhase = phases.find(
      (item) => item.name.toLowerCase() === phaseName.toLowerCase(),
    );
    if (resolvedPhase) {
      resolvedPhaseId = resolvedPhase.id;
      phaseName = resolvedPhase.name;
    } else {
      warnings.push(
        `Phase "${phaseName}" was not found. It will be created on import.`,
      );
    }
  } else if (!resolvedPhaseId && !phaseName) {
    errors.push(
      'Phase is required. This row will not be assigned to the first phase.',
    );
  }

  const effectivePhase = resolvedPhase;

  if (effectivePhase && (isStartValid || isEndValid)) {
    const phaseStartKey = toTaskDayKey(effectivePhase.startDate);
    const phaseEndKey = toTaskDayKey(effectivePhase.endDate);
    if (!phaseStartKey && !phaseEndKey) {
      errors.push(
        `Phase "${effectivePhase.name}" has no start/end dates. Update the phase dates first.`,
      );
    } else {
      const phaseDateErrors = taskDatesOutsidePhaseErrors({
        start: isStartValid ? importDayToLocalDate(normalizedStart) : null,
        end: isEndValid ? importDayToLocalDate(normalizedEnd) : null,
        phaseStart: effectivePhase.startDate,
        phaseEnd: effectivePhase.endDate,
      });
      if (phaseDateErrors.startDate) errors.push(phaseDateErrors.startDate);
      if (phaseDateErrors.endDate) errors.push(phaseDateErrors.endDate);
    }
  }

  if (!['Low', 'Medium', 'High', 'Critical'].includes(updated.priority)) {
    errors.push(`Priority "${row.priority}" is invalid. Please select one.`);
  }

  if (
    ![
      'To_Do',
      'In_Progress',
      'Submitted_for_Review',
      'Approved',
      'Rework',
      'Done',
    ].includes(updated.status)
  ) {
    errors.push(`Status "${row.status}" is invalid. Please select one.`);
  }

  let parentTaskTitle = updated.parentTaskTitle;
  if (parentTaskTitle?.trim()) {
    if (parentTaskTitle.trim().toLowerCase() === updated.title.trim().toLowerCase()) {
      warnings.push(
        'Parent Task cannot be the same as the task title. This row will import as a top-level task.',
      );
      parentTaskTitle = '';
    }
  }

  return {
    ...updated,
    parentTaskTitle,
    startDate: isStartValid ? normalizedStart : updated.startDate,
    endDate: isEndValid ? normalizedEnd : updated.endDate,
    baselineStart: normalizedBaselineStart || undefined,
    baselineEnd: normalizedBaselineEnd || undefined,
    actualStart: normalizedActualStart || undefined,
    actualEnd: normalizedActualEnd || undefined,
    durationDays:
      updated.durationDays != null &&
      Number.isFinite(Number(updated.durationDays))
        ? Math.round(Number(updated.durationDays) * 10) / 10
        : undefined,
    baselineDurationDays:
      updated.baselineDurationDays != null &&
      Number.isFinite(Number(updated.baselineDurationDays))
        ? Math.round(Number(updated.baselineDurationDays) * 10) / 10
        : undefined,
    progressApproved:
      updated.progressApproved != null &&
      Number.isFinite(Number(updated.progressApproved))
        ? Math.max(0, Math.min(100, Math.round(Number(updated.progressApproved))))
        : undefined,
    phaseName,
    resolvedAssigneeId,
    resolvedPhaseId,
    importMode,
    resolvedTaskId,
    errors,
    warnings,
  };
}

function annotateParentTaskWarnings(
  rows: ExcelTaskPreviewRow[],
  existingTasks?: PreviewExistingTask[],
): ExcelTaskPreviewRow[] {
  const fileTitles = new Set(
    rows.map((r) => r.title.trim().toLowerCase()).filter(Boolean),
  );
  const existingTitles = new Set(
    (existingTasks ?? []).map((t) => t.title.trim().toLowerCase()),
  );

  return rows.map((row) => {
    const parent = row.parentTaskTitle?.trim();
    if (!parent) return row;
    const key = parent.toLowerCase();
    if (fileTitles.has(key) || existingTitles.has(key)) return row;
    return {
      ...row,
      warnings: [
        ...row.warnings,
        `Parent task "${parent}" was not found in this file. It will be linked if that task already exists on the project.`,
      ],
    };
  });
}

function normalizeTaskPriority(priority: string) {
  const lowerPriority = priority.toLowerCase().trim();
  if (['critical'].includes(lowerPriority)) return 'Critical';
  if (['high'].includes(lowerPriority)) return 'High';
  if (['medium'].includes(lowerPriority)) return 'Medium';
  if (['low'].includes(lowerPriority)) return 'Low';
  return priority;
}

function normalizeTaskStatus(status: string) {
  const lowerStatus = status.toLowerCase().trim().replace(/[\s-]/g, '_');
  if (['to_do', 'todo', 'to do'].includes(lowerStatus)) return 'To_Do';
  if (['in_progress', 'inprogress', 'in progress'].includes(lowerStatus)) {
    return 'In_Progress';
  }
  if (
    [
      'submitted_for_review',
      'submittedforreview',
      'submitted for review',
    ].includes(lowerStatus)
  ) {
    return 'Submitted_for_Review';
  }
  if (['approved'].includes(lowerStatus)) return 'Approved';
  if (['rework'].includes(lowerStatus)) return 'Rework';
  if (['done', 'completed', 'closed'].includes(lowerStatus)) return 'Done';
  return status;
}

function resolveTaskImportMatch(
  title: string,
  parentTitle?: string | null,
  existingTasks?: PreviewExistingTask[],
  claimedIds?: Set<string>,
): { importMode: 'create' | 'update'; resolvedTaskId?: string } {
  const lower = title.trim().toLowerCase();
  if (!lower || !existingTasks?.length) return { importMode: 'create' };
  const parentKey = (parentTitle ?? '').trim().toLowerCase();
  const sameParent = existingTasks.filter(
    (t) =>
      t.title.trim().toLowerCase() === lower &&
      (t.parentTitle ?? '').trim().toLowerCase() === parentKey,
  );
  const unusedSameParent = sameParent.find((t) => !claimedIds?.has(t.id));
  if (unusedSameParent) {
    claimedIds?.add(unusedSameParent.id);
    return { importMode: 'update', resolvedTaskId: unusedSameParent.id };
  }
  if (parentTitle === undefined) {
    const byTitle = existingTasks.filter(
      (t) => t.title.trim().toLowerCase() === lower && !claimedIds?.has(t.id),
    );
    if (byTitle.length === 1) {
      claimedIds?.add(byTitle[0].id);
      return { importMode: 'update', resolvedTaskId: byTitle[0].id };
    }
  }
  return { importMode: 'create' };
}

/** Duplicate titles under the same parent are kept (same as MPP import). */
export function markExtraSameParentTitleRows(
  rows: ExcelTaskPreviewRow[],
): ExcelTaskPreviewRow[] {
  return rows.map((row) => ({
    ...row,
    errors: row.errors.filter((e) => !isSameParentDuplicateError(e)),
  }));
}

function isSameParentDuplicateError(message: string): boolean {
  return (
    message.startsWith('Duplicate task title "') &&
    (message.includes('under the same parent') ||
      message.includes('found in this file'))
  );
}

function toTaskDayKey(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTaskDayLabel(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function importDayToLocalDate(value?: string | null): Date | null {
  const key = toTaskDayKey(value);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function findProjectTaskAssignee(
  assigneeName: string,
  assignees: PreviewAssignee[],
): PreviewAssignee | undefined {
  const normalized = assigneeName.toLowerCase().trim();
  return assignees.find(
    (assignee) =>
      assignee.displayName.toLowerCase() === normalized ||
      assignee.email.toLowerCase() === normalized ||
      assignee.name.toLowerCase() === normalized,
  );
}

function taskDatesOutsidePhaseErrors(options: {
  start?: Date | null;
  end?: Date | null;
  phaseStart?: string | Date | null;
  phaseEnd?: string | Date | null;
}): { startDate?: string; endDate?: string } {
  const phaseStartYmd = toTaskDayKey(options.phaseStart);
  const phaseEndYmd = toTaskDayKey(options.phaseEnd);
  const next: { startDate?: string; endDate?: string } = {};
  if (!phaseStartYmd && !phaseEndYmd) return next;

  if (options.start) {
    const startKey = toTaskDayKey(options.start);
    if (phaseStartYmd && startKey < phaseStartYmd) {
      next.startDate = `Start date must be on or after phase start (${formatTaskDayLabel(phaseStartYmd)})`;
    } else if (phaseEndYmd && startKey > phaseEndYmd) {
      next.startDate = `Start date must be on or before phase end (${formatTaskDayLabel(phaseEndYmd)})`;
    }
  }

  if (options.end) {
    const endKey = toTaskDayKey(options.end);
    if (phaseEndYmd && endKey > phaseEndYmd) {
      next.endDate = `End date must be on or before phase end (${formatTaskDayLabel(phaseEndYmd)})`;
    } else if (phaseStartYmd && endKey < phaseStartYmd) {
      next.endDate = `End date must be on or after phase start (${formatTaskDayLabel(phaseStartYmd)})`;
    }
  }

  return next;
}

function parsePredecessorsCell(raw?: string | null): ParsedExcelPredecessor[] {
  if (!raw || !String(raw).trim()) return [];

  const parts = String(raw)
    .split(/[;\n|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedExcelPredecessor[] = [];
  for (const part of parts) {
    const withLag = part.match(
      /^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*([+-]\s*\d+)\s*d?\s*\)\s*$/i,
    );
    if (withLag) {
      const lag = Number.parseInt(withLag[3].replace(/\s/g, ''), 10);
      results.push({
        title: withLag[1].trim(),
        depType: withLag[2].toUpperCase() as ParsedExcelPredecessor['depType'],
        lagDays: Number.isFinite(lag) ? lag : 0,
      });
      continue;
    }

    const withType = part.match(/^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*\)\s*$/i);
    if (withType) {
      results.push({
        title: withType[1].trim(),
        depType: withType[2].toUpperCase() as ParsedExcelPredecessor['depType'],
        lagDays: 0,
      });
      continue;
    }

    const bare = part.replace(/\s*\([^)]*\)\s*$/, '').trim() || part;
    if (bare) {
      results.push({ title: bare, depType: 'FS', lagDays: 0 });
    }
  }

  return results.filter((p) => p.title.length > 0);
}
