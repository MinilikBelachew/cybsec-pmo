import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';

export function utcTodayDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function inclusiveCalendarDays(
  start?: Date | null,
  end?: Date | null,
): number | null {
  if (!start || !end) return null;
  const startMs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

function resolveDurationDays(
  durationDays: unknown,
  start?: Date | null,
  end?: Date | null,
): number | null {
  if (
    durationDays != null &&
    Number.isFinite(Number(durationDays)) &&
    Number(durationDays) > 0
  ) {
    return Number(durationDays);
  }
  return inclusiveCalendarDays(start, end);
}

export function freezeBaselineIfEmpty(params: {
  start?: Date | null;
  end?: Date | null;
  durationDays?: unknown;
  baselineStart?: Date | null;
  baselineEnd?: Date | null;
}): {
  baselineStart?: Date | null;
  baselineEnd?: Date | null;
  baselineDurationDays?: number | null;
} {
  if (params.baselineStart || params.baselineEnd) {
    return {};
  }
  if (!params.start && !params.end) {
    return {};
  }
  return {
    baselineStart: params.start ?? null,
    baselineEnd: params.end ?? null,
    baselineDurationDays: resolveDurationDays(
      params.durationDays,
      params.start,
      params.end,
    ),
  };
}

export function actualStampsForTaskStatus(params: {
  nextStatus: TaskStatus;
  actualStart?: Date | null;
  actualEnd?: Date | null;
}): { actualStart?: Date; actualEnd?: Date } {
  const today = utcTodayDate();
  const started =
    params.nextStatus === TaskStatus.In_Progress ||
    params.nextStatus === TaskStatus.Submitted_for_Review ||
    params.nextStatus === TaskStatus.Rework ||
    params.nextStatus === TaskStatus.Approved ||
    params.nextStatus === TaskStatus.Done;
  const finished =
    params.nextStatus === TaskStatus.Done ||
    params.nextStatus === TaskStatus.Approved;
  const data: { actualStart?: Date; actualEnd?: Date } = {};
  if (started && !params.actualStart) {
    data.actualStart = today;
  }
  if (finished && !params.actualEnd) {
    data.actualEnd = today;
  }
  return data;
}

export function projectScheduleOnStatusChange(params: {
  from: ProjectStatus;
  to: ProjectStatus;
  startDate: Date;
  endDate: Date;
  durationDays?: unknown;
  baselineStartDate?: Date | null;
  baselineEndDate?: Date | null;
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
}): {
  baselineStartDate?: Date | null;
  baselineEndDate?: Date | null;
  baselineDurationDays?: number | null;
  actualStartDate?: Date;
  actualEndDate?: Date;
} {
  const data: {
    baselineStartDate?: Date | null;
    baselineEndDate?: Date | null;
    baselineDurationDays?: number | null;
    actualStartDate?: Date;
    actualEndDate?: Date;
  } = {};

  if (params.from === ProjectStatus.Draft && params.to === ProjectStatus.Active) {
    const freeze = freezeBaselineIfEmpty({
      start: params.startDate,
      end: params.endDate,
      durationDays: params.durationDays,
      baselineStart: params.baselineStartDate,
      baselineEnd: params.baselineEndDate,
    });
    if (freeze.baselineStart !== undefined) {
      data.baselineStartDate = freeze.baselineStart;
    }
    if (freeze.baselineEnd !== undefined) {
      data.baselineEndDate = freeze.baselineEnd;
    }
    if (freeze.baselineDurationDays !== undefined) {
      data.baselineDurationDays = freeze.baselineDurationDays;
    }
    if (!params.actualStartDate) {
      data.actualStartDate = utcTodayDate();
    }
  }

  if (params.to === ProjectStatus.Closed && !params.actualEndDate) {
    data.actualEndDate = utcTodayDate();
  }

  return data;
}

export async function freezeUnbaselinedTasksForProject(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  const tasks = await tx.task.findMany({
    where: {
      projectId,
      baselineStart: null,
      baselineEnd: null,
      OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      durationDays: true,
    },
  });

  for (const task of tasks) {
    const freeze = freezeBaselineIfEmpty({
      start: task.startDate,
      end: task.endDate,
      durationDays: task.durationDays,
      baselineStart: null,
      baselineEnd: null,
    });
    if (
      freeze.baselineStart === undefined &&
      freeze.baselineEnd === undefined
    ) {
      continue;
    }
    await tx.task.update({
      where: { id: task.id },
      data: {
        ...(freeze.baselineStart !== undefined
          ? { baselineStart: freeze.baselineStart }
          : {}),
        ...(freeze.baselineEnd !== undefined
          ? { baselineEnd: freeze.baselineEnd }
          : {}),
        ...(freeze.baselineDurationDays !== undefined
          ? { baselineDurationDays: freeze.baselineDurationDays }
          : {}),
      },
    });
  }
}
