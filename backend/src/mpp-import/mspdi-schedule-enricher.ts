import { ParsedMppProject, ParsedMppTask } from './mpp-import.types';

type MspdiTaskSchedule = {
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  baselineStartDate?: string;
  baselineFinishDate?: string;
  baselineDurationDays?: number;
  actualStartDate?: string;
  actualFinishDate?: string;
  percentComplete?: number;
  cost?: number;
};

/**
 * MPXJ often leaves nested MSPDI `<Baseline><Start/><Finish/></Baseline>` null on
 * Task.getBaselineStart(). Enrich parsed tasks from the raw XML before persist.
 */
export function enrichParsedFromMspdiXml(
  parsed: ParsedMppProject,
  xmlBuffer: Buffer,
): ParsedMppProject {
  const xml = stripBom(xmlBuffer.toString('utf8'));
  if (!/<Baseline[\s>]|<ActualStart[\s>]|<Cost[\s>]/i.test(xml)) {
    return {
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  }

  const byUid = extractMspdiTaskSchedules(xml);
  if (byUid.size === 0) {
    return {
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  }

  const sourceTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks: ParsedMppTask[] = sourceTasks.map((task) => {
    const extra = byUid.get(Number(task.uid));
    if (!extra) return task;

    return {
      ...task,
      // Prefer MSPDI XML values for schedule fidelity fields MPXJ often drops.
      startDate: pick(extra.startDate, task.startDate),
      finishDate: pick(extra.finishDate, task.finishDate),
      durationDays: pickNum(extra.durationDays, task.durationDays),
      baselineStartDate: pick(extra.baselineStartDate, task.baselineStartDate),
      baselineFinishDate: pick(
        extra.baselineFinishDate,
        task.baselineFinishDate,
      ),
      baselineDurationDays: pickNum(
        extra.baselineDurationDays,
        task.baselineDurationDays,
      ),
      actualStartDate: pick(extra.actualStartDate, task.actualStartDate),
      actualFinishDate: pick(extra.actualFinishDate, task.actualFinishDate),
      percentComplete: pickNum(extra.percentComplete, task.percentComplete),
      cost: pickNum(extra.cost, task.cost),
    };
  });

  // Prefer L1 portfolio root when present; else outline-0 project summary.
  const root =
    tasks.find((t) => t.summary && (t.outlineLevel ?? -1) === 1) ??
    tasks.find((t) => t.summary && (t.outlineLevel ?? -1) === 0);

  const project = { ...parsed.project };
  if (root) {
    // L1/root summary from MSPDI XML is the source of truth for project schedule.
    project.startDate = pick(root.startDate, project.startDate);
    project.finishDate = pick(root.finishDate, project.finishDate);
    project.durationDays = pickNum(root.durationDays, project.durationDays);
    project.baselineStartDate = pick(
      root.baselineStartDate,
      project.baselineStartDate,
    );
    project.baselineFinishDate = pick(
      root.baselineFinishDate,
      project.baselineFinishDate,
    );
    project.baselineDurationDays = pickNum(
      root.baselineDurationDays,
      project.baselineDurationDays,
    );
    project.actualStartDate = pick(
      root.actualStartDate,
      (project as { actualStartDate?: string }).actualStartDate,
    );
    project.actualFinishDate = pick(
      root.actualFinishDate,
      (project as { actualFinishDate?: string }).actualFinishDate,
    );
    const rootPct = clampPercent(root.percentComplete);
    if (rootPct != null) {
      project.percentComplete = rootPct;
    }
    const rootCost = pickNum(root.cost, project.cost);
    if (rootCost != null) {
      project.cost = rootCost;
    }
    const durationDays = project.durationDays;
    const baselineDurationDays = project.baselineDurationDays;
    if (
      durationDays != null &&
      baselineDurationDays != null &&
      Number.isFinite(durationDays) &&
      Number.isFinite(baselineDurationDays)
    ) {
      project.durationVarianceDays =
        Math.round((Number(durationDays) - Number(baselineDurationDays)) * 10) /
        10;
    }
  }

  return { ...parsed, project, tasks };
}

export function looksLikeMspdi(xmlOrName: string): boolean {
  const lower = xmlOrName.toLowerCase();
  if (lower.endsWith('.xml') || lower.endsWith('.mspdi')) return true;
  return (
    /<Project[\s>]/i.test(xmlOrName) ||
    /xmlns:.*?project/i.test(xmlOrName) ||
    /<Baseline[\s>]/i.test(xmlOrName)
  );
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function pick(primary?: string | null, fallback?: string): string | undefined {
  if (primary != null && String(primary).trim() !== '') return String(primary);
  return fallback;
}

function pickNum(
  primary?: number | null,
  fallback?: number,
): number | undefined {
  if (primary != null && Number.isFinite(Number(primary)) && Number(primary) > 0) {
    return Number(primary);
  }
  return fallback;
}

function clampPercent(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(Number(value))) return undefined;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function extractMspdiTaskSchedules(
  xml: string,
): Map<number, MspdiTaskSchedule> {
  const map = new Map<number, MspdiTaskSchedule>();
  // Index-based scan avoids catastrophic backtracking on large MSPDI files.
  const openRe = /<Task\b[^>]*>/gi;
  let open: RegExpExecArray | null;

  while ((open = openRe.exec(xml)) !== null) {
    const start = open.index + open[0].length;
    const close = xml.toLowerCase().indexOf('</task>', start);
    if (close < 0) break;
    const body = xml.slice(start, close);
    openRe.lastIndex = close + 7;

    const uidMatch = /<UID>\s*(\d+)\s*<\/UID>/i.exec(body);
    if (!uidMatch) continue;
    const uid = Number(uidMatch[1]);
    if (!Number.isFinite(uid)) continue;

    const schedule: MspdiTaskSchedule = {
      startDate: toIsoDay(firstTag(body, 'Start')),
      finishDate: toIsoDay(firstTag(body, 'Finish')),
      durationDays: isoDurationToWorkingDays(firstTag(body, 'Duration')),
      actualStartDate: toIsoDay(firstTag(body, 'ActualStart')),
      actualFinishDate: toIsoDay(firstTag(body, 'ActualFinish')),
      percentComplete: toPercent(firstTag(body, 'PercentComplete')),
      cost: toCost(firstTag(body, 'Cost')),
    };

    const baseline = pickBaselineBlock(body);
    if (baseline) {
      schedule.baselineStartDate = toIsoDay(
        firstTag(baseline, 'Start') ?? firstTag(baseline, 'BaselineStart'),
      );
      schedule.baselineFinishDate = toIsoDay(
        firstTag(baseline, 'Finish') ?? firstTag(baseline, 'BaselineFinish'),
      );
      schedule.baselineDurationDays = isoDurationToWorkingDays(
        firstTag(baseline, 'Duration') ??
          firstTag(baseline, 'BaselineDuration'),
      );
    }

    if (
      schedule.baselineStartDate ||
      schedule.baselineFinishDate ||
      schedule.baselineDurationDays != null ||
      schedule.actualStartDate ||
      schedule.actualFinishDate ||
      schedule.durationDays != null ||
      schedule.cost != null
    ) {
      map.set(uid, schedule);
    }
  }

  return map;
}

function pickBaselineBlock(taskBody: string): string | undefined {
  const re = /<Baseline(\s[^>]*)?>([\s\S]*?)<\/Baseline>/gi;
  let match: RegExpExecArray | null;
  let fallback: string | undefined;

  while ((match = re.exec(taskBody)) !== null) {
    const attrs = match[1] ?? '';
    const body = match[2];
    const numberMatch = /\bNumber\s*=\s*"(\d+)"/i.exec(attrs);
    const number = numberMatch ? Number(numberMatch[1]) : 0;
    if (number === 0) return body;
    if (!fallback) fallback = body;
  }

  return fallback;
}

function firstTag(body: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'i');
  const m = re.exec(body);
  return m?.[1]?.trim() || undefined;
}

function toIsoDay(value?: string): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : undefined;
}

function toPercent(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toCost(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** MSPDI duration is usually PT{hours}H…; Cybsec stores working days (8h). */
export function isoDurationToWorkingDays(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m =
    /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(
      iso.trim(),
    );
  if (!m) return undefined;
  const hours =
    Number(m[1] || 0) + Number(m[2] || 0) / 60 + Number(m[3] || 0) / 3600;
  if (!Number.isFinite(hours) || hours <= 0) return undefined;
  return Math.round((hours / 8) * 10) / 10;
}
