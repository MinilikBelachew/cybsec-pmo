/**
 * Local MSPDI builder — Microsoft Project XML with Resources / Assignments
 * so the Resource Names column populates, plus schedule fields (dates, %, baseline).
 */
import { MspdiExportRequestPayload, MspdiExportTaskPayload } from './mspdi-export.types';
import { splitResourceNames } from './resource-names.util';

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

function toDateTime(day?: string, end = false) {
  if (!day) return '';
  const d = day.slice(0, 10);
  return `${d}T${end ? '17:00:00' : '08:00:00'}`;
}

/** MSPDI duration: working days → PT hours (8h day). Supports fractions. */
function toIsoDuration(days?: number | null, milestone = false): string {
  if (milestone) {
    return 'PT0H0M0S';
  }
  if (days == null || !Number.isFinite(Number(days)) || Number(days) <= 0) {
    return '';
  }
  const hours = Math.round(Number(days) * 8 * 10) / 10;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes > 0) {
    return `PT${whole}H${minutes}M0S`;
  }
  return `PT${whole}H0M0S`;
}

/** Prefer stored duration; if missing but start=finish, treat as 1 day. */
function resolveDurationDays(task: {
  durationDays?: number | null;
  startDate?: string;
  finishDate?: string;
}): number | undefined {
  if (
    task.durationDays != null &&
    Number.isFinite(Number(task.durationDays)) &&
    Number(task.durationDays) > 0
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

/** MSPDI variance is in tenths of a minute (4800 = 1 day @ 8h). */
function toVarianceTenths(days?: number | null): string {
  if (days == null || !Number.isFinite(Number(days))) return '';
  return String(Math.round(Number(days) * 4800));
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
  const off = (dayType: number) => `        <WeekDay>
          <DayType>${dayType}</DayType>
          <DayWorking>0</DayWorking>
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
  },
): string {
  const start = toDateTime(task.startDate);
  const finish = toDateTime(task.finishDate, true);
  const baselineStart = toDateTime(task.baselineStart);
  const baselineFinish = toDateTime(task.baselineFinish, true);
  const durationDays = task.milestone
    ? 0
    : resolveDurationDays({
        durationDays: task.durationDays,
        startDate: task.startDate,
        finishDate: task.finishDate,
      });
  const duration =
    toIsoDuration(durationDays, Boolean(task.milestone)) || 'PT8H0M0S';
  const baselineDuration = toIsoDuration(task.baselineDurationDays);
  const durationVariance =
    task.durationVarianceDays != null
      ? task.durationVarianceDays
      : durationDays != null && task.baselineDurationDays != null
        ? Math.round(
            (Number(durationDays) - Number(task.baselineDurationDays)) * 10,
          ) / 10
        : undefined;

  const parts: string[] = [];
  if (start) parts.push(`      <Start>${start}</Start>`);
  if (finish) parts.push(`      <Finish>${finish}</Finish>`);
  parts.push(`      <Duration>${duration}</Duration>`);
  parts.push(`      <Manual>0</Manual>`);
  parts.push(`      <Work>${duration}</Work>`);
  if (baselineStart || baselineFinish || task.baselineDurationDays) {
    parts.push(`      <Baseline>`);
    if (baselineStart) parts.push(`        <Start>${baselineStart}</Start>`);
    if (baselineFinish) parts.push(`        <Finish>${baselineFinish}</Finish>`);
    if (baselineDuration) {
      parts.push(`        <Duration>${baselineDuration}</Duration>`);
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
  parts.push(
    `      <PercentComplete>${Math.max(0, Math.min(100, task.percentComplete ?? 0))}</PercentComplete>`,
  );
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
  const idToUid = new Map<string, number>();
  let uid = 1;
  for (const task of payload.tasks) {
    idToUid.set(task.id, uid++);
  }

  const outlineNumbers = buildOutlineNumbers(payload.tasks);
  const taskById = new Map<string, MspdiExportTaskPayload>(
    payload.tasks.map((t) => [t.id, t]),
  );

  const depsBySuccessor = new Map<string, typeof payload.dependencies>();
  for (const dep of payload.dependencies) {
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
  });

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>12</SaveVersion>
  <Name>${esc(name)}</Name>
  <Title>${esc(name)}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <NewTasksAreManual>0</NewTasksAreManual>
  ${payload.project.startDate ? `<StartDate>${toDateTime(payload.project.startDate)}</StartDate>` : ''}
  ${payload.project.finishDate ? `<FinishDate>${toDateTime(payload.project.finishDate, true)}</FinishDate>` : ''}
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DurationFormat>7</DurationFormat>
  <WorkFormat>2</WorkFormat>
  <TaskUpdatesResource>1</TaskUpdatesResource>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
${renderWeekDays()}
${renderExceptions(holidays)}
    </Calendar>
  </Calendars>
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

  for (const task of payload.tasks) {
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
      <Type>${task.summary ? 1 : 0}</Type>
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
      <Notes>${esc(task.notes || '')}</Notes>
`;

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

  type XmlResource = { uid: number; name: string; email?: string };
  const resourcesByKey = new Map<string, XmlResource>();
  const assignmentRows: { taskId: string; resourceKey: string }[] = [];
  let resourceUid = 1;

  const ensureResource = (name: string, email?: string): string => {
    const key = name.trim().toLowerCase();
    const existing = resourcesByKey.get(key);
    if (existing) {
      if (email && !existing.email) existing.email = email;
      return key;
    }
    resourcesByKey.set(key, {
      uid: resourceUid++,
      name: name.trim(),
      email,
    });
    return key;
  };

  const hasTaskNames = payload.tasks.some((task) =>
    Boolean(task.resourceNames?.trim()),
  );
  if (hasTaskNames) {
    for (const task of payload.tasks) {
      for (const name of splitResourceNames(task.resourceNames)) {
        assignmentRows.push({
          taskId: task.id,
          resourceKey: ensureResource(name),
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
        uid: resourceUid++,
        name: resource.name.trim(),
        email: resource.email,
      });
    }
    for (const assignment of payload.assignments ?? []) {
      assignmentRows.push({
        taskId: assignment.taskId,
        resourceKey: assignment.resourceId,
      });
    }
  }

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
  for (const resource of [...resourcesByKey.values()].sort(
    (a, b) => a.uid - b.uid,
  )) {
    xml += `    <Resource>
      <UID>${resource.uid}</UID>
      <ID>${resource.uid}</ID>
      <Name>${esc(resource.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <MaxUnits>1.00</MaxUnits>
      <CalendarUID>1</CalendarUID>
      ${resource.email ? `<EmailAddress>${esc(resource.email)}</EmailAddress>` : ''}
    </Resource>
`;
  }
  xml += `  </Resources>
`;

  xml += `  <Assignments>
`;
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
    const workDays = resolveDurationDays({
      durationDays: task?.durationDays,
      startDate: task?.startDate,
      finishDate: task?.finishDate,
    });
    const work = toIsoDuration(workDays) || 'PT8H0M0S';
    xml += `    <Assignment>
      <UID>${assignmentUid}</UID>
      <ResourceUID>${resource.uid}</ResourceUID>
      <TaskUID>${taskUid}</TaskUID>
      <Units>1</Units>
      <Work>${work}</Work>
      <RegularWork>${work}</RegularWork>
      <RemainingWork>${work}</RemainingWork>
      ${start ? `<Start>${start}</Start>` : ''}
      ${finish ? `<Finish>${finish}</Finish>` : ''}
      <FinishVariance>0</FinishVariance>
      <WorkContour>0</WorkContour>
    </Assignment>
`;
    assignmentUid += 1;
  }
  xml += `  </Assignments>
</Project>`;

  return Buffer.from(xml, 'utf8');
}
