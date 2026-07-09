import { Decimal } from '@prisma/client/runtime/library';

export type AllocationHoursInput = {
  hours: Decimal | null;
  percent: Decimal | null;
  status: string;
  startDate: Date;
  endDate: Date | null;
};

export function isAllocationActive(
  allocation: AllocationHoursInput,
  asOf: Date = new Date(),
): boolean {
  if (allocation.status !== 'Active') {
    return false;
  }

  const day = stripTime(asOf);
  const start = stripTime(allocation.startDate);
  if (start > day) {
    return false;
  }

  if (allocation.endDate) {
    const end = stripTime(allocation.endDate);
    if (end < day) {
      return false;
    }
  }

  return true;
}

export function isAllocationOverlappingWindow(
  allocation: AllocationHoursInput,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  if (allocation.status !== 'Active') {
    return false;
  }

  const allocStart = stripTime(allocation.startDate);
  const allocEnd = allocation.endDate ? stripTime(allocation.endDate) : null;
  const rangeStart = stripTime(windowStart);
  const rangeEnd = stripTime(windowEnd);

  if (allocStart > rangeEnd) {
    return false;
  }

  if (allocEnd && allocEnd < rangeStart) {
    return false;
  }

  return true;
}

export function allocationWeeklyHours(
  allocation: AllocationHoursInput,
  weeklyCapacity: number,
): number {
  if (allocation.hours != null) {
    return Number(allocation.hours);
  }

  if (allocation.percent != null) {
    return (weeklyCapacity * Number(allocation.percent)) / 100;
  }

  return 0;
}

export function sumActiveAllocationHours(
  allocations: AllocationHoursInput[],
  weeklyCapacity: number,
  asOf: Date = new Date(),
): number {
  return allocations
    .filter((row) => isAllocationActive(row, asOf))
    .reduce((total, row) => total + allocationWeeklyHours(row, weeklyCapacity), 0);
}

export function sumOverlappingAllocationHours(
  allocations: AllocationHoursInput[],
  weeklyCapacity: number,
  windowStart: Date,
  windowEnd: Date,
): number {
  return allocations
    .filter((row) => isAllocationOverlappingWindow(row, windowStart, windowEnd))
    .reduce((total, row) => total + allocationWeeklyHours(row, weeklyCapacity), 0);
}

export function buildAvailabilitySummary(
  weeklyCapacity: number,
  allocatedHours: number,
) {
  const remainingHours = weeklyCapacity - allocatedHours;
  const utilizationPercent =
    weeklyCapacity > 0 ? Math.round((allocatedHours / weeklyCapacity) * 100) : 0;

  return {
    weeklyCapacityHours: weeklyCapacity,
    allocatedHours: roundHours(allocatedHours),
    remainingHours: roundHours(remainingHours),
    utilizationPercent,
    isOverAllocated: allocatedHours > weeklyCapacity,
    isFullyBooked: remainingHours <= 0,
  };
}

/** Keep Prisma DATE values on UTC calendar days to avoid TZ-boundary drift. */
function stripTime(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
