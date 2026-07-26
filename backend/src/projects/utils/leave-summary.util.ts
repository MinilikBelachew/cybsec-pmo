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
  fromDate: Date;
  toDate: Date;
  leaveType: string;
  isApproved: boolean;
  kekaStatus?: number | null;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countInclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
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

/** Map stored leave requests (already from/to ranges) into UI summaries. */
export function groupLeaveRecords(records: LeaveRecordInput[]): LeaveRangeSummary[] {
  if (records.length === 0) {
    return [];
  }

  return [...records]
    .sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime())
    .map((record) => {
      const from = toDateKey(record.fromDate);
      const to = toDateKey(record.toDate);
      return {
        id: record.id,
        type: record.leaveType,
        from,
        to,
        days: countInclusiveDays(from, to),
        status: resolveLeaveStatus(record),
      };
    });
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
