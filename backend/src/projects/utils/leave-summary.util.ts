export type LeaveRangeSummary = {
  id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: 'approved' | 'pending' | 'rejected';
};

type LeaveRecordInput = {
  id: string;
  leaveDate: Date;
  leaveType: string;
  isApproved: boolean;
  kekaStatus?: number | null;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveLeaveStatus(record: LeaveRecordInput): LeaveRangeSummary['status'] {
  if (record.isApproved) {
    return 'approved';
  }
  if (record.kekaStatus === 2) {
    return 'rejected';
  }
  return 'pending';
}

export function groupLeaveRecords(records: LeaveRecordInput[]): LeaveRangeSummary[] {
  if (records.length === 0) {
    return [];
  }

  const sorted = [...records].sort(
    (a, b) => a.leaveDate.getTime() - b.leaveDate.getTime(),
  );

  const ranges: LeaveRangeSummary[] = [];
  let current: LeaveRangeSummary | null = null;

  for (const record of sorted) {
    const status = resolveLeaveStatus(record);
    const dateKey = toDateKey(record.leaveDate);

    if (
      !current ||
      current.type !== record.leaveType ||
      current.status !== status ||
      addDays(new Date(`${current.to}T00:00:00.000Z`), 1).toISOString().slice(0, 10) !==
        dateKey
    ) {
      current = {
        id: record.id,
        type: record.leaveType,
        from: dateKey,
        to: dateKey,
        days: 1,
        status,
      };
      ranges.push(current);
      continue;
    }

    current.to = dateKey;
    current.days += 1;
  }

  return ranges;
}

export function filterLeaveInWindow(
  ranges: LeaveRangeSummary[],
  windowStart?: Date,
  windowEnd?: Date,
): LeaveRangeSummary[] {
  if (!windowStart || !windowEnd) {
    return ranges;
  }

  const startKey = toDateKey(windowStart);
  const endKey = toDateKey(windowEnd);

  return ranges.filter((range) => range.from <= endKey && range.to >= startKey);
}
