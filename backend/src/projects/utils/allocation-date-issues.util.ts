export type AllocationDateIssueKind =
  | 'outside_project_window'
  | 'not_started_yet';

export type AllocationDateRow = {
  id: string;
  employeeName: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
};

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date = new Date()): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function isAllocationOutsideProjectWindow(
  allocationStart: Date,
  allocationEnd: Date | null,
  projectStart: Date,
  projectEnd: Date,
): boolean {
  const effectiveEnd = allocationEnd ?? projectEnd;
  return (
    allocationStart < projectStart ||
    allocationStart > projectEnd ||
    effectiveEnd < projectStart ||
    effectiveEnd > projectEnd
  );
}

export function isAllocationNotStartedYet(
  allocationStart: Date,
  today: Date = startOfUtcDay(),
): boolean {
  return allocationStart > today;
}

export function buildAllocationDateIssueMessages(
  row: AllocationDateRow,
  projectStart: Date,
  projectEnd: Date,
  today: Date = startOfUtcDay(),
): { kinds: AllocationDateIssueKind[]; messages: string[] } {
  const kinds: AllocationDateIssueKind[] = [];
  const messages: string[] = [];

  if (
    isAllocationOutsideProjectWindow(
      row.startDate,
      row.endDate,
      projectStart,
      projectEnd,
    )
  ) {
    kinds.push('outside_project_window');
    messages.push(
      `${row.employeeName}'s allocation (${formatDateOnly(row.startDate)} – ${row.endDate ? formatDateOnly(row.endDate) : 'open'}) falls outside the project window (${formatDateOnly(projectStart)} – ${formatDateOnly(projectEnd)}).`,
    );
  }

  if (row.status === 'Active' && isAllocationNotStartedYet(row.startDate, today)) {
    kinds.push('not_started_yet');
    messages.push(
      `${row.employeeName} cannot log hours until ${formatDateOnly(row.startDate)}.`,
    );
  }

  return { kinds, messages };
}

export type AlignAllocationPreviewRow = {
  allocationId: string;
  employeeName: string;
  currentStartDate: string;
  currentEndDate: string | null;
  proposedStartDate: string;
  proposedEndDate: string | null;
};

export function computeAlignedAllocationDates(
  allocationStart: Date,
  allocationEnd: Date | null,
  projectStart: Date,
  projectEnd: Date,
): { startDate: Date; endDate: Date } {
  let startDate =
    allocationStart < projectStart ? projectStart : allocationStart;
  if (startDate > projectEnd) {
    startDate = projectEnd;
  }

  let endDate = allocationEnd ?? projectEnd;
  if (endDate > projectEnd) {
    endDate = projectEnd;
  }
  if (endDate < projectStart) {
    endDate = projectStart;
  }
  if (endDate < startDate) {
    endDate = startDate;
  }

  return { startDate, endDate };
}

export function buildAlignAllocationPreview(
  allocations: AllocationDateRow[],
  projectStart: Date,
  projectEnd: Date,
): AlignAllocationPreviewRow[] {
  const preview: AlignAllocationPreviewRow[] = [];

  for (const row of allocations) {
    if (!['Active', 'Pending'].includes(row.status)) {
      continue;
    }

    const aligned = computeAlignedAllocationDates(
      row.startDate,
      row.endDate,
      projectStart,
      projectEnd,
    );
    const currentStart = formatDateOnly(row.startDate);
    const currentEnd = row.endDate ? formatDateOnly(row.endDate) : null;
    const proposedStart = formatDateOnly(aligned.startDate);
    const proposedEnd = formatDateOnly(aligned.endDate);

    if (currentStart === proposedStart && currentEnd === proposedEnd) {
      continue;
    }

    preview.push({
      allocationId: row.id,
      employeeName: row.employeeName,
      currentStartDate: currentStart,
      currentEndDate: currentEnd,
      proposedStartDate: proposedStart,
      proposedEndDate: proposedEnd,
    });
  }

  return preview;
}
