export function formatAllocationDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatAllocationDateRange(
  startDate: string,
  endDate: string | null,
): string {
  if (!endDate) {
    return `${formatAllocationDateLabel(startDate)} – open`;
  }
  return `${formatAllocationDateLabel(startDate)} – ${formatAllocationDateLabel(endDate)}`;
}

export function formatDateValue(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isAllocationNotStartedYet(
  startDate: string,
  today: string = todayIsoDate(),
): boolean {
  return startDate > today;
}

export function isAllocationOutsideProjectWindow(
  allocationStart: string,
  allocationEnd: string | null,
  projectStart: string,
  projectEnd: string,
): boolean {
  const effectiveEnd = allocationEnd ?? projectEnd;
  return (
    allocationStart < projectStart ||
    allocationStart > projectEnd ||
    effectiveEnd < projectStart ||
    effectiveEnd > projectEnd
  );
}
