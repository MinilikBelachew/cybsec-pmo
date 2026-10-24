/**
 * Local MSPDI builder — Microsoft Project XML with Resources / Assignments
 * so the Resource Names column populates, plus schedule fields (dates, %, baseline).
 */
import { randomUUID } from 'crypto';
import {
  MspdiExportCustomFieldDef,
  MspdiExportDependencyPayload,
  MspdiExportRequestPayload,
  MspdiExportTaskPayload,
} from './mspdi-export.types';
import { splitResourceNames } from './resource-names.util';

/**
 * Drop predecessor links that form MSP-style cycles with the outline
 * (summary pred + cross-summary child links). Keeps export openable in MS Project.
 */
export function filterMspdiCycleDependencies(
  tasks: MspdiExportTaskPayload[],
  deps: MspdiExportDependencyPayload[],
): { dependencies: MspdiExportDependencyPayload[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!deps.length || !tasks.length) {
    return { dependencies: deps, warnings };
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const parentOf = new Map<string, string>();
  for (const task of tasks) {
    if (task.parentId && taskById.has(task.parentId)) {
      parentOf.set(task.id, task.parentId);
    }
  }

  const ancestorsOf = (id: string): string[] => {
    const out: string[] = [];
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur && parentOf.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = parentOf.get(cur);
      if (cur) out.push(cur);
    }
    return out;
  };

  const descendantsOf = (id: string): Set<string> => {
    const kids = new Map<string, string[]>();
    for (const [child, parent] of parentOf) {
      const list = kids.get(parent) ?? [];
      list.push(child);
      kids.set(parent, list);
    }
    const out = new Set<string>();
    const stack = [...(kids.get(id) ?? [])];
    while (stack.length) {
      const u = stack.pop()!;
      if (out.has(u)) continue;
      out.add(u);
      for (const c of kids.get(u) ?? []) stack.push(c);
    }
    return out;
  };

  const buildAdj = (active: MspdiExportDependencyPayload[]) => {
    const adj = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
    };
    for (const dep of active) {
      add(dep.predecessorId, dep.successorId);
      const succ = taskById.get(dep.successorId);
      if (succ?.summary) {
        for (const d of descendantsOf(dep.successorId)) {
          add(dep.predecessorId, d);
        }
      }
    }
    for (const [child, parent] of parentOf) {
      add(child, parent);
    }
    return adj;
  };

  const hasCycle = (adj: Map<string, Set<string>>): boolean => {
    const vis = new Map<string, number>(); // 0=unseen 1=stack 2=done
    const dfs = (u: string): boolean => {
      vis.set(u, 1);
      for (const v of adj.get(u) ?? []) {
        const state = vis.get(v) ?? 0;
        if (state === 1) return true;
        if (state === 0 && dfs(v)) return true;
      }
      vis.set(u, 2);
      return false;
    };
    for (const id of taskById.keys()) {
      if ((vis.get(id) ?? 0) === 0 && dfs(id)) return true;
    }
    return false;
  };

  let active = [...deps];
  // Prefer dropping cross-summary child→child links first (most common MSP breakers).
  const score = (dep: MspdiExportDependencyPayload): number => {
    const predAnc = new Set(ancestorsOf(dep.predecessorId));
    const succAnc = new Set(ancestorsOf(dep.successorId));
    let cross = 0;
    for (const a of predAnc) {
      if (taskById.get(a)?.summary && !succAnc.has(a)) {
        for (const b of succAnc) {
          if (taskById.get(b)?.summary && a !== b) cross += 1;
        }
      }
    }
    return cross;
  };
  active.sort((a, b) => score(b) - score(a));

  const kept: MspdiExportDependencyPayload[] = [];
  for (const dep of active) {
    const candidate = [...kept, dep];
    if (hasCycle(buildAdj(candidate))) {
      const predName = taskById.get(dep.predecessorId)?.name ?? dep.predecessorId;
      const succName = taskById.get(dep.successorId)?.name ?? dep.successorId;
      warnings.push(
        `Skipped circular predecessor "${predName}" → "${succName}" on export.`,
      );
      continue;
    }
    kept.push(dep);
  }

  return { dependencies: kept, warnings };
}

/** Ensure defs cover every custom slot used on tasks (alias-aware). */
export function mergeCustomFieldDefsForExport(
  defs: MspdiExportCustomFieldDef[] | undefined,
  tasks: MspdiExportTaskPayload[],
): MspdiExportCustomFieldDef[] {
  const byName = new Map<string, MspdiExportCustomFieldDef>();
  for (const def of defs ?? []) {
    if (!def?.fieldName?.trim()) continue;
    byName.set(def.fieldName.trim().toLowerCase(), { ...def });
  }
  for (const task of tasks) {
    for (const entry of task.customFields ?? []) {
      const raw = entry.fieldName?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (byName.has(key)) continue;
      const aliasMatch = [...byName.values()].find(
        (d) => d.alias?.trim().toLowerCase() === key,
      );
      if (aliasMatch) continue;
      if (/^(Text|Number|Flag|Date|Cost|Duration|Start|Finish)\d+$/i.test(raw)) {
        byName.set(key, { fieldName: raw });
      }
    }
  }
  return [...byName.values()];
}

function esc(str: string) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toDateTime(value?: string, end = false) {
  if (!value) return '';
  const trimmed = String(value).trim();
  const withTime =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (withTime) {
    const seconds = withTime[3] ?? '00';
    return `${withTime[1]}T${withTime[2]}:${seconds}`;
  }
  const d = trimmed.slice(0, 10);
  return `${d}T${end ? '17:00:00' : '08:00:00'}`;
}

function addMinutesToMspdiDateTime(dtStr?: string | null, minutes = 0): string {
  if (!dtStr || !minutes) return dtStr || '';
  const parts = String(dtStr).split('T');
  if (parts.length !== 2) return String(dtStr);
  const [d, t] = parts;
  const [y, m, day] = d.split('-').map(Number);
  const [h, min, s] = t.split(':').map(Number);
  const date = new Date(y, m - 1, day, h, min, s || 0);
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** MSPDI duration: working days → PT hours (8h day). Supports fractions. */
function toIsoDuration(days?: number | null, milestone = false): string {
  if (milestone && (days == null || Number(days) === 0)) {
    return 'PT0H0M0S';
  }
  if (days == null || !Number.isFinite(Number(days)) || Number(days) < 0) {
    return '';
  }
  if (Number(days) === 0) {
    return 'PT0H0M0S';
  }
  const hours = Math.round(Number(days) * 8 * 10) / 10;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes > 0) {
    return `PT${whole}H${minutes}M0S`;
  }
  return `PT${whole}H0M0S`;
}

/**
 * Prefer stored working-day duration (MPP import / PMO). Fall back to inclusive
 * calendar span only when durationDays is missing (scratch projects).
 */
function calendarDurationDays(task: {
  durationDays?: number | null;
  startDate?: string;
  finishDate?: string;
}): number | undefined {
  if (
    task.durationDays != null &&
    Number.isFinite(Number(task.durationDays)) &&
    Number(task.durationDays) >= 0
  ) {
    return Number(task.durationDays);
  }
  const s = task.startDate?.slice(0, 10);
  const f = task.finishDate?.slice(0, 10);
  if (s && f) {
    const startMs = Date.parse(`${s}T00:00:00Z`);
    const endMs = Date.parse(`${f}T00:00:00Z`);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
    }
  }
  return undefined;
}

/** Planned effort as MSP Work. */
function toIsoWork(hours?: number | null): string {
  if (hours == null || !Number.isFinite(Number(hours)) || Number(hours) <= 0) {
    return '';
  }
  const value = Math.round(Number(hours) * 10) / 10;
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  if (minutes > 0) {
    return `PT${whole}H${minutes}M0S`;
  }
  return `PT${whole}H0M0S`;
}

/** MSPDI variance is in tenths of a minute (4800 = 1 day @ 8h). */
function toVarianceTenths(days?: number | null): string {
  if (days == null || !Number.isFinite(Number(days))) return '';
  return String(Math.round(Number(days) * 4800));
}

const MSP_TASK_TEXT_PIDS = [
  188743731, 188743734, 188743737, 188743740, 188743743,
  188743746, 188743747, 188743748, 188743749, 188743750,
];

/** Local MSP custom-field PIDs (pjCustomTask* / pjTask*). */
function mspCustomFieldId(fieldName: string, fallbackFieldId?: string): string {
  if (fallbackFieldId && /^\d{8,9}$/.test(fallbackFieldId)) return fallbackFieldId;
  const m = /^(Text|Number|Flag|Date|Cost|Duration|Start|Finish)(\d+)$/i.exec(
    fieldName.trim(),
  );
  if (!m) return '';
  const family = m[1].toLowerCase();
  const index = Number(m[2]);
  if (!Number.isFinite(index) || index < 1) return '';

  if (family === 'text') {
    if (index <= 10) return String(MSP_TASK_TEXT_PIDS[index - 1]);
    if (index <= 30) return String(188743997 + (index - 11));
    return '';
  }
  if (family === 'number') {
    if (index <= 5) return String(188743767 + (index - 1));
    if (index <= 20) return String(188743982 + (index - 6));
    return '';
  }
  if (family === 'cost') {
    if (index <= 3) return String(188743786 + (index - 1));
    if (index <= 10) return String(188743938 + (index - 4));
    return '';
  }
  if (family === 'date') {
    if (index <= 10) return String(188743945 + (index - 1));
    return '';
  }
  if (family === 'duration') {
    if (index <= 3) return String(188743783 + (index - 1));
    if (index <= 10) return String(188743955 + (index - 4));
    return '';
  }
  if (family === 'flag') {
    if (index <= 10) return String(188743752 + (index - 1));
    if (index <= 20) return String(188743972 + (index - 11));
    return '';
  }
  if (family === 'start') {
    if (index <= 5) return String(188743732 + (index - 1) * 3);
    if (index <= 10) return String(188743962 + (index - 6) * 2);
    return '';
  }
  if (family === 'finish') {
    if (index <= 5) return String(188743733 + (index - 1) * 3);
    if (index <= 10) return String(188743963 + (index - 6) * 2);
    return '';
  }
  return '';
}

function cfTypeCode(type?: string, fieldName?: string): string {
  const t = (type || fieldName || '').toUpperCase();
  if (t.startsWith('COST')) return '0';
  if (t.startsWith('DATE')) return '1';
  if (t.startsWith('DURATION')) return '2';
  if (t.startsWith('FINISH')) return '3';
  if (t.startsWith('FLAG')) return '4';
  if (t.startsWith('NUMBER')) return '5';
  if (t.startsWith('START')) return '6';
  return '7'; // Text
}

function renderExtendedAttributesDefs(
  defs?: MspdiExportRequestPayload['customFieldDefs'],
): string {
  const seenFieldIds = new Set<string>();
  let block = `  <ExtendedAttributes>\n`;
  // Always emit Flag1 as IsMilestone so MS Project round-trips milestones reliably
  block += `    <ExtendedAttribute>
      <FieldID>188743752</FieldID>
      <FieldName>Flag1</FieldName>
      <CFType>4</CFType>
      <ElemType>20</ElemType>
      <Alias>IsMilestone</Alias>
    </ExtendedAttribute>\n`;
  seenFieldIds.add('188743752');

  if (defs?.length) {
    for (const def of defs) {
      if (!def.alias?.trim()) continue;
      const fieldId = mspCustomFieldId(def.fieldName, def.fieldId);
      if (!fieldId || seenFieldIds.has(fieldId)) continue;
      seenFieldIds.add(fieldId);
      block += `    <ExtendedAttribute>
      <FieldID>${esc(fieldId)}</FieldID>
      <FieldName>${esc(def.fieldName)}</FieldName>
      <CFType>${cfTypeCode(def.type, def.fieldName)}</CFType>
      <ElemType>20</ElemType>
      <Alias>${esc(def.alias.trim())}</Alias>
    </ExtendedAttribute>
`;
    }
  }
  block += `  </ExtendedAttributes>\n`;
  return block;
}

function resolveCustomFieldSlot(
  fieldName: string,
  defs?: MspdiExportCustomFieldDef[],
): { fieldName: string; fieldId: string; def?: MspdiExportCustomFieldDef } | null {
  const raw = fieldName.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const byName = new Map(
    (defs ?? []).map((d) => [d.fieldName.trim().toLowerCase(), d]),
  );
  const byAlias = new Map(
    (defs ?? [])
      .filter((d) => d.alias?.trim())
      .map((d) => [d.alias!.trim().toLowerCase(), d]),
  );
  const def = byName.get(key) ?? byAlias.get(key);
  const slotName = def?.fieldName?.trim() || raw;
  const fieldId = mspCustomFieldId(slotName, def?.fieldId);
  if (!fieldId) return null;
  return { fieldName: slotName, fieldId, def };
}

function renderTaskExtendedAttributes(
  customFields?: { fieldName: string; value: string }[],
  defs?: MspdiExportRequestPayload['customFieldDefs'],
): string {
  if (!customFields?.length) return '';
  let block = '';
  const seenInTask = new Set<string>();
  for (const entry of customFields) {
    if (!entry?.fieldName || !entry.value?.trim()) continue;
    const text = entry.value.trim();
    const resolved = resolveCustomFieldSlot(entry.fieldName, defs);
    if (!resolved) continue;
    if (!resolved.def?.alias && (text === '0' || text === '0.00')) continue;
    if (seenInTask.has(resolved.fieldId)) continue;
    seenInTask.add(resolved.fieldId);
    block += `      <ExtendedAttribute>
        <FieldID>${esc(resolved.fieldId)}</FieldID>
        <Value>${esc(text)}</Value>
      </ExtendedAttribute>
`;
  }
  return block;
}

/** MSPDI ConstraintType numeric codes. */
function constraintTypeCode(type?: string): number {
  switch ((type || 'ASAP').trim().toUpperCase()) {
    case 'ALAP':
      return 1;
    case 'MSO':
      return 2;
    case 'MFO':
      return 3;
    case 'SNET':
      return 4;
    case 'SNLT':
      return 5;
    case 'FNET':
      return 6;
    case 'FNLT':
      return 7;
    case 'ASAP':
    default:
      return 0;
  }
}

function renderConstraintXml(task: MspdiExportTaskPayload): string {
  const type = (task.constraintType || 'ASAP').trim().toUpperCase();
  const code = constraintTypeCode(type);
  const needsDate = type !== 'ASAP' && type !== 'ALAP';
  const date =
    needsDate && task.constraintDate
      ? toDateTime(task.constraintDate)
      : '';
  let block = `      <ConstraintType>${code}</ConstraintType>
`;
  if (date) {
    block += `      <ConstraintDate>${date}</ConstraintDate>
`;
  }
  return block;
}

function depTypeCode(type?: string) {
  switch (String(type || 'FS').toUpperCase()) {
    case 'FF':
      return 0;
    case 'SF':
      return 2;
    case 'SS':
      return 3;
    default:
      return 1;
  }
}

function renderWeekDays(): string {
  const working = (dayType: number) => `        <WeekDay>
          <DayType>${dayType}</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>
            <WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime>
          </WorkingTimes>
        </WeekDay>`;
  // Empty WorkingTimes on off-days avoids null hour ranges after Project Save As .mpp.
  const off = (dayType: number) => `        <WeekDay>
          <DayType>${dayType}</DayType>
          <DayWorking>0</DayWorking>
          <WorkingTimes/>
        </WeekDay>`;
  return `      <WeekDays>
${off(1)}
${working(2)}
${working(3)}
${working(4)}
${working(5)}
${working(6)}
${off(7)}
      </WeekDays>`;
}

function newCalendarGuid(): string {
  return randomUUID().toUpperCase();
}

function resourceCalendarUid(resourceUid: number): number {
  return resourceUid + 1;
}

function renderCalendarsXml(
  holidays: NonNullable<MspdiExportRequestPayload['holidays']>,
  resources: { uid: number; name: string }[],
): string {
  const weekDays = renderWeekDays();
  const exceptions = renderExceptions(holidays);
  let xml = `  <Calendars>
    <Calendar>
      <UID>1</UID>
      <GUID>${newCalendarGuid()}</GUID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <IsBaselineCalendar>0</IsBaselineCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
${weekDays}
${exceptions}
    </Calendar>
`;
  for (const resource of resources) {
    if (resource.uid <= 0) continue;
    xml += `    <Calendar>
      <UID>${resourceCalendarUid(resource.uid)}</UID>
      <GUID>${newCalendarGuid()}</GUID>
      <Name>${esc(resource.name)}</Name>
      <IsBaseCalendar>0</IsBaseCalendar>
      <IsBaselineCalendar>0</IsBaselineCalendar>
      <BaseCalendarUID>1</BaseCalendarUID>
${weekDays}
    </Calendar>
`;
  }
  xml += `  </Calendars>
`;
  return xml;
}

function renderExceptions(
  holidays: NonNullable<MspdiExportRequestPayload['holidays']>,
): string {
  if (!holidays.length) return '';
  const body = holidays
    .map((h, index) => {
      const day = String(h.date).slice(0, 10);
      return `      <Exception>
        <EnteredByOccurrences>0</EnteredByOccurrences>
        <TimePeriod>
          <FromDate>${day}T00:00:00</FromDate>
          <ToDate>${day}T23:59:00</ToDate>
        </TimePeriod>
        <Occurrences>1</Occurrences>
        <Name>${esc(h.name || `Holiday ${index + 1}`)}</Name>
        <Type>1</Type>
        <DayWorking>0</DayWorking>
      </Exception>`;
    })
    .join('\n');
  return `      <Exceptions>
${body}
      </Exceptions>`;
}

function renderScheduleFields(
  task: Partial<MspdiExportTaskPayload> & {
    durationVarianceDays?: number;
    summary?: boolean;
  },
): string {
  const explicitDuration = calendarDurationDays({
    durationDays: task.durationDays,
    startDate: task.startDate,
    finishDate: task.finishDate,
  });
  const durationDays = task.milestone
    ? task.durationDays != null && Number(task.durationDays) > 0
      ? Number(task.durationDays)
      : 0
    : explicitDuration;
  const isZeroDurationMilestone = Boolean(task.milestone && durationDays === 0);
  const start = toDateTime(task.startDate);
  const finish = toDateTime(
    isZeroDurationMilestone ? task.startDate || task.finishDate : task.finishDate,
    !isZeroDurationMilestone,
  );
  const baselineStart = toDateTime(task.baselineStart);
  const baselineFinish = toDateTime(
    isZeroDurationMilestone
      ? task.baselineStart || task.baselineFinish
      : task.baselineFinish,
    !isZeroDurationMilestone,
  );
  const duration =
    toIsoDuration(durationDays, Boolean(task.milestone)) ||
    (task.milestone ? 'PT0H0M0S' : 'PT8H0M0S');
  const work = toIsoWork(task.workHours);
  const baselineDurationDays = isZeroDurationMilestone
    ? 0
    : task.milestone
      ? task.baselineDurationDays != null && Number(task.baselineDurationDays) > 0
        ? Number(task.baselineDurationDays)
        : 0
      : task.baselineDurationDays;
  const baselineDuration = toIsoDuration(
    baselineDurationDays,
    Boolean(task.milestone),
  );
  const durationVariance =
    task.durationVarianceDays != null
      ? task.durationVarianceDays
      : durationDays != null && baselineDurationDays != null
        ? Math.round(
          (Number(durationDays) - Number(baselineDurationDays)) * 10,
        ) / 10
        : undefined;

  const parts: string[] = [];
  if (start) parts.push(`      <Start>${start}</Start>`);
  if (finish) parts.push(`      <Finish>${finish}</Finish>`);
  parts.push(`      <Duration>${duration}</Duration>`);
  // Summaries auto-schedule so MS Project rolls up children; milestones stay manual; leaves follow taskMode/manual.
  const manual = task.summary
    ? 0
    : task.milestone
      ? 1
      : task.taskMode?.trim().toLowerCase() === 'auto'
        ? 0
        : 1;
  parts.push(`      <Manual>${manual}</Manual>`);
  if (work) parts.push(`      <Work>${work}</Work>`);
  if (
    baselineStart ||
    baselineFinish ||
    baselineDurationDays != null ||
    (task.milestone && baselineDuration)
  ) {
    // Flat fields help some Project views; nested Baseline Number=0 is required for Baseline columns.
    if (baselineStart) {
      parts.push(`      <BaselineStart>${baselineStart}</BaselineStart>`);
    }
    if (baselineFinish) {
      parts.push(`      <BaselineFinish>${baselineFinish}</BaselineFinish>`);
    }
    if (baselineDuration) {
      parts.push(`      <BaselineDuration>${baselineDuration}</BaselineDuration>`);
    }
    parts.push(`      <Baseline>`);
    parts.push(`        <Number>0</Number>`);
    if (baselineStart) parts.push(`        <Start>${baselineStart}</Start>`);
    if (baselineFinish) parts.push(`        <Finish>${baselineFinish}</Finish>`);
    if (baselineDuration) {
      parts.push(`        <Duration>${baselineDuration}</Duration>`);
      parts.push(`        <DurationFormat>7</DurationFormat>`);
    }
    parts.push(`      </Baseline>`);
  }
  const startVar = toVarianceTenths(task.startVarianceDays);
  const finishVar = toVarianceTenths(task.finishVarianceDays);
  const durVar = toVarianceTenths(durationVariance);
  if (startVar) parts.push(`      <StartVariance>${startVar}</StartVariance>`);
  if (finishVar) {
    parts.push(`      <FinishVariance>${finishVar}</FinishVariance>`);
  }
  if (durVar) {
    parts.push(`      <DurationVariance>${durVar}</DurationVariance>`);
  }
  const percent = Math.max(0, Math.min(100, task.percentComplete ?? 0));
  parts.push(`      <PercentComplete>${percent}</PercentComplete>`);
  parts.push(`      <PercentWorkComplete>${percent}</PercentWorkComplete>`);
  if (percent > 0) {
    const durDays = durationDays ?? calendarDurationDays(task) ?? (task.milestone ? 0 : 1);
    const actDays = Math.round((durDays * percent) / 100 * 10) / 10;
    const remDays = Math.max(0, Math.round((durDays - actDays) * 10) / 10);
    parts.push(`      <ActualDuration>${toIsoDuration(actDays, Boolean(task.milestone))}</ActualDuration>`);
    parts.push(`      <RemainingDuration>${toIsoDuration(remDays, Boolean(task.milestone))}</RemainingDuration>`);

    if (task.workHours != null && Number(task.workHours) > 0) {
      const actHours = Math.round((Number(task.workHours) * percent) / 100 * 10) / 10;
      const remHours = Math.max(0, Math.round((Number(task.workHours) - actHours) * 10) / 10);
      parts.push(`      <ActualWork>${toIsoWork(actHours) || 'PT0H0M0S'}</ActualWork>`);
      parts.push(`      <RemainingWork>${toIsoWork(remHours) || 'PT0H0M0S'}</RemainingWork>`);
    }
    const actStart = task.startDate ? toDateTime(task.startDate) : '';
    if (actStart) {
      parts.push(`      <ActualStart>${actStart}</ActualStart>`);
      if (percent < 100) {
        const actMinutes = Math.round(actDays * 480);
        const stopDate = addMinutesToMspdiDateTime(actStart, actMinutes);
        if (stopDate) {
          parts.push(`      <Stop>${stopDate}</Stop>`);
          parts.push(`      <Resume>${stopDate}</Resume>`);
        }
      }
    }
    if (percent >= 100 && (task.finishDate || task.startDate)) {
      const isZeroMs = Boolean(task.milestone && durationDays === 0);
      parts.push(
        `      <ActualFinish>${toDateTime(task.finishDate || task.startDate, !isZeroMs)}</ActualFinish>`,
      );
    }
  }
  return parts.join('\n');
}

/** Build outline numbers (1, 1.1, 1.2, 2, …) from parent links + order. */
function buildOutlineNumbers(
  tasks: MspdiExportTaskPayload[],
): Map<string, string> {
  const children = new Map<string | undefined, string[]>();
  for (const task of tasks) {
    const parent = task.parentId;
    const list = children.get(parent) ?? [];
    list.push(task.id);
    children.set(parent, list);
  }

  const out = new Map<string, string>();
  const walk = (parentId: string | undefined, prefix: string) => {
    const kids = children.get(parentId) ?? [];
    kids.forEach((id, index) => {
      const number = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      out.set(id, number);
      walk(id, number);
    });
  };
  walk(undefined, '');
  return out;
}

export function buildLocalMspdiXml(payload: MspdiExportRequestPayload): Buffer {
  const customFieldDefs = mergeCustomFieldDefsForExport(
    payload.customFieldDefs,
    payload.tasks,
  );
  const { dependencies: safeDeps } = filterMspdiCycleDependencies(
    payload.tasks,
    payload.dependencies ?? [],
  );
  const working: MspdiExportRequestPayload = {
    ...payload,
    customFieldDefs,
    dependencies: safeDeps,
  };

  const idToUid = new Map<string, number>();
  let uid = 1;
  for (const task of working.tasks) {
    idToUid.set(task.id, uid++);
  }

  const outlineNumbers = buildOutlineNumbers(working.tasks);
  const taskById = new Map<string, MspdiExportTaskPayload>(
    working.tasks.map((t) => [t.id, t]),
  );

  const depsBySuccessor = new Map<string, typeof working.dependencies>();
  for (const dep of working.dependencies) {
    const list = depsBySuccessor.get(dep.successorId) ?? [];
    list.push(dep);
    depsBySuccessor.set(dep.successorId, list);
  }

  const name = payload.project.name || 'Exported Schedule';
  const holidays = payload.holidays ?? [];
  const projectSchedule = renderScheduleFields({
    startDate: payload.project.startDate,
    finishDate: payload.project.finishDate,
    baselineStart: payload.project.baselineStart,
    baselineFinish: payload.project.baselineFinish,
    durationDays: payload.project.durationDays,
    baselineDurationDays: payload.project.baselineDurationDays,
    percentComplete: payload.project.percentComplete,
    durationVarianceDays: payload.project.durationVarianceDays,
    startVarianceDays: undefined,
    finishVarianceDays: undefined,
    summary: true,
  });

  // Collect resources before calendars so each gets a full derived calendar.
  const resourcesByKey = new Map<
    string,
    { uid: number; name: string; email?: string }
  >();
  const assignmentRows: { taskId: string; resourceKey: string }[] = [];
  let resourceUidCounter = 1;
  const ensureResource = (resourceName: string, email?: string): string => {
    const key = resourceName.trim().toLowerCase();
    const existing = resourcesByKey.get(key);
    if (existing) {
      if (email && !existing.email) existing.email = email;
      return key;
    }
    resourcesByKey.set(key, {
      uid: resourceUidCounter++,
      name: resourceName.trim(),
      email,
    });
    return key;
  };
  const hasTaskNames = payload.tasks.some((task) =>
    Boolean(task.resourceNames?.trim()),
  );
  if (hasTaskNames) {
    for (const task of payload.tasks) {
      if (task.milestone) continue;
      for (const resourceName of splitResourceNames(task.resourceNames)) {
        assignmentRows.push({
          taskId: task.id,
          resourceKey: ensureResource(resourceName),
        });
      }
    }
    for (const resource of payload.resources ?? []) {
      if (!resource.name?.trim() || !resource.email?.trim()) continue;
      const existing = resourcesByKey.get(resource.name.trim().toLowerCase());
      if (existing && !existing.email) existing.email = resource.email.trim();
    }
  } else {
    for (const resource of payload.resources ?? []) {
      if (!resource?.id || !resource.name?.trim()) continue;
      resourcesByKey.set(resource.id, {
        uid: resourceUidCounter++,
        name: resource.name.trim(),
        email: resource.email,
      });
    }
    for (const assignment of payload.assignments ?? []) {
      const task = taskById.get(assignment.taskId);
      if (task?.milestone) continue;
      assignmentRows.push({
        taskId: assignment.taskId,
        resourceKey: assignment.resourceId,
      });
    }
  }
  const sortedResources = [...resourcesByKey.values()].sort(
    (a, b) => a.uid - b.uid,
  );

  let latestProgressDate: string | null = null;
  for (const t of working.tasks) {
    const pct = Math.max(0, Math.min(100, t.percentComplete ?? 0));
    if (pct > 0) {
      const d = pct >= 100 ? (t.finishDate || t.startDate) : t.startDate;
      if (d) {
        const str = String(d).split('T')[0];
        if (!latestProgressDate || str > latestProgressDate) {
          latestProgressDate = str;
        }
      }
    }
  }
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = latestProgressDate
    ? (todayStr > latestProgressDate ? todayStr : latestProgressDate)
    : (payload.project.finishDate ? String(payload.project.finishDate).split('T')[0] : todayStr);
  const statusDate = `${targetDate}T17:00:00`;
  const currentDate = `${todayStr}T12:00:00`;

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${esc(name)}</Name>
  <Title>${esc(name)}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <NewTasksAreManual>0</NewTasksAreManual>
  <HonorConstraints>0</HonorConstraints>
  <SplitsInProgressTasks>1</SplitsInProgressTasks>
  ${payload.project.startDate ? `<StartDate>${toDateTime(payload.project.startDate)}</StartDate>` : ''}
  ${payload.project.finishDate ? `<FinishDate>${toDateTime(payload.project.finishDate, true)}</FinishDate>` : ''}
  <CurrentDate>${currentDate}</CurrentDate>
  <StatusDate>${statusDate}</StatusDate>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DurationFormat>7</DurationFormat>
  <WorkFormat>2</WorkFormat>
  <TaskUpdatesResource>1</TaskUpdatesResource>
${renderExtendedAttributesDefs(working.customFieldDefs)}${renderCalendarsXml(holidays, sortedResources)}
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${esc(name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <OutlineLevel>0</OutlineLevel>
      <OutlineNumber>0</OutlineNumber>
      <WBS>0</WBS>
      <Summary>1</Summary>
      <Critical>0</Critical>
      <Priority>500</Priority>
${projectSchedule}
      <Milestone>0</Milestone>
      <Estimated>0</Estimated>
      <Active>1</Active>
    </Task>
`;

  for (const task of working.tasks) {
    const taskUid = idToUid.get(task.id)!;
    const links = depsBySuccessor.get(task.id) ?? [];
    const outlineNumber = outlineNumbers.get(task.id) || String(taskUid);
    const schedule = renderScheduleFields({
      ...task,
      durationVarianceDays:
        task.durationDays != null && task.baselineDurationDays != null
          ? Math.round(
            (Number(task.durationDays) - Number(task.baselineDurationDays)) *
            10,
          ) / 10
          : undefined,
    });

    xml += `    <Task>
      <UID>${taskUid}</UID>
      <ID>${taskUid}</ID>
      <Name>${esc(task.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <OutlineLevel>${task.outlineLevel ?? 1}</OutlineLevel>
      <OutlineNumber>${esc(outlineNumber)}</OutlineNumber>
      <WBS>${esc(outlineNumber)}</WBS>
      <Summary>${task.summary ? 1 : 0}</Summary>
      <Critical>0</Critical>
      <Priority>${task.priority ?? 500}</Priority>
${schedule}
      <Milestone>${task.milestone ? 1 : 0}</Milestone>
      <Estimated>0</Estimated>
      <Active>1</Active>
      <CalendarUID>1</CalendarUID>
${renderConstraintXml(task)}      <Notes>${esc(task.notes || '')}</Notes>
${task.milestone ? `      <ExtendedAttribute>
        <FieldID>188743752</FieldID>
        <Value>1</Value>
      </ExtendedAttribute>\n` : ''}${renderTaskExtendedAttributes(task.customFields, working.customFieldDefs)}`;

    for (const dep of links) {
      const predUid = idToUid.get(dep.predecessorId);
      if (predUid == null) continue;
      const lag = (dep.lagDays || 0) * 4800;
      xml += `      <PredecessorLink>
        <PredecessorUID>${predUid}</PredecessorUID>
        <Type>${depTypeCode(dep.type)}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${lag}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
`;
    }

    xml += `    </Task>
`;
  }

  xml += `  </Tasks>
`;

  xml += `  <Resources>
    <Resource>
      <UID>0</UID>
      <ID>0</ID>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <MaxUnits>1.00</MaxUnits>
      <CalendarUID>1</CalendarUID>
    </Resource>
`;
  for (const resource of sortedResources) {
    xml += `    <Resource>
      <UID>${resource.uid}</UID>
      <ID>${resource.uid}</ID>
      <Name>${esc(resource.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <MaxUnits>1.00</MaxUnits>
      <CalendarUID>${resourceCalendarUid(resource.uid)}</CalendarUID>
      ${resource.email ? `<EmailAddress>${esc(resource.email)}</EmailAddress>` : ''}
    </Resource>
`;
  }
  xml += `  </Resources>
`;

  xml += `  <Assignments>
`;
  const assignmentCountByTaskId = new Map<string, number>();
  for (const row of assignmentRows) {
    assignmentCountByTaskId.set(
      row.taskId,
      (assignmentCountByTaskId.get(row.taskId) ?? 0) + 1,
    );
  }

  // Project often uses large UIDs for assignments; start above task UIDs.
  let assignmentUid = 1_048_577;
  for (const row of assignmentRows) {
    const taskUid = idToUid.get(row.taskId);
    const resource = resourcesByKey.get(row.resourceKey);
    if (taskUid == null || resource == null) continue;
    const task = taskById.get(row.taskId);
    const start =
      toDateTime(task?.startDate) || toDateTime(payload.project.startDate);
    const finish =
      toDateTime(task?.finishDate, true) ||
      toDateTime(payload.project.finishDate, true);
    const work = toIsoWork(task?.workHours);
    const percent = Math.max(0, Math.min(100, task?.percentComplete ?? 0));
    const assignCount = assignmentCountByTaskId.get(row.taskId) || 1;
    let workLines = '';
    if (work) {
      const totalHours = task?.workHours ? Number(task.workHours) / assignCount : 0;
      const actHours = Math.round((totalHours * percent) / 100 * 10) / 10;
      const remHours = Math.max(0, Math.round((totalHours - actHours) * 10) / 10);
      const assignWork = toIsoWork(totalHours) || 'PT0H0M0S';
      const actualWork = toIsoWork(actHours) || 'PT0H0M0S';
      const remainingWork = toIsoWork(remHours) || 'PT0H0M0S';
      workLines = `      <Work>${assignWork}</Work>
      <RegularWork>${assignWork}</RegularWork>
      <RemainingWork>${remainingWork}</RemainingWork>
      <ActualWork>${actualWork}</ActualWork>
      <PercentWorkComplete>${percent}</PercentWorkComplete>`;
    } else {
      workLines = `      <PercentWorkComplete>${percent}</PercentWorkComplete>`;
    }
    const actualStart = percent > 0 ? (toDateTime(task?.startDate) || start) : '';
    const actualFinish = percent >= 100 ? (toDateTime(task?.finishDate, true) || finish) : '';
    let stopLines = '';
    if (percent > 0 && percent < 100 && actualStart) {
      const durDays = task?.durationDays ?? (task?.milestone ? 0 : 1);
      const actMinutes = Math.round(((durDays * percent) / 100) * 480);
      const stopDate = addMinutesToMspdiDateTime(actualStart, actMinutes);
      if (stopDate) {
        stopLines = `      <Stop>${stopDate}</Stop>\n      <Resume>${stopDate}</Resume>\n`;
      }
    }

    xml += `    <Assignment>
      <UID>${assignmentUid}</UID>
      <ResourceUID>${resource.uid}</ResourceUID>
      <TaskUID>${taskUid}</TaskUID>
      <Units>1</Units>
${workLines}
      ${start ? `      <Start>${start}</Start>\n` : ''}${finish ? `      <Finish>${finish}</Finish>\n` : ''}${actualStart ? `      <ActualStart>${actualStart}</ActualStart>\n` : ''}${actualFinish ? `      <ActualFinish>${actualFinish}</ActualFinish>\n` : ''}${stopLines}      <FinishVariance>0</FinishVariance>
      <WorkContour>0</WorkContour>
    </Assignment>
`;
    assignmentUid += 1;
  }
  xml += `  </Assignments>
</Project>`;

  return Buffer.from(xml, 'utf8');
}
