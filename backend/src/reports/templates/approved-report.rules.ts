/**
 * Thresholds for the approved status report.
 *
 * These are the bands agreed in the PMO template sign-off. They are collected
 * here rather than inlined at each call site so they can be lifted into
 * AppSetting and tuned without a code change.
 */
export const APPROVED_REPORT_RULES = {
  /** Task lateness in calendar days: amber from 5, red beyond 15. */
  taskLateDays: { amber: 5, red: 15 },
  /**
   * Milestone lateness as a percentage of the milestone's own length, so a
   * short milestone is not judged by the same absolute slip as a long one.
   */
  milestoneLatePercent: { amber: 5, red: 15 },
  /**
   * A milestone carrying an invoice or a client deliverable is judged on the
   * tighter end: any slip is amber and the standard amber band turns red.
   */
  milestoneWithBillingLatePercent: { amber: 0, red: 5 },
  /**
   * An issue still open this many days after its target resolution date raises
   * a risk against the milestone it affects.
   */
  riskFromOverdueIssueDays: { standard: 7, blocking: 3 },
  /** Meeting actions default to five working days out. */
  defaultActionDueWorkingDays: 5,
} as const;

export function milestoneRagFromVariance(
  varianceDays: number | null,
  milestoneLengthDays: number | null,
  hasBillingOrDeliverable: boolean,
): string | null {
  if (varianceDays == null) return null;
  if (varianceDays <= 0) return 'green';
  const bands = hasBillingOrDeliverable
    ? APPROVED_REPORT_RULES.milestoneWithBillingLatePercent
    : APPROVED_REPORT_RULES.milestoneLatePercent;

  if (!milestoneLengthDays || milestoneLengthDays <= 0) {
    // No length to measure against, so fall back to the absolute task bands.
    const dayBands = APPROVED_REPORT_RULES.taskLateDays;
    if (varianceDays > dayBands.red) return 'red';
    if (varianceDays >= dayBands.amber) return 'amber';
    return 'green';
  }

  const slipPercent = (varianceDays / milestoneLengthDays) * 100;
  if (slipPercent > bands.red) return 'red';
  if (slipPercent > bands.amber) return 'amber';
  return 'green';
}

export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) -
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) /
      MS_PER_DAY,
  );
}

/**
 * Adds working days, skipping weekends and any supplied public holidays.
 * Used for the five-working-day default on meeting action points.
 */
export function addWorkingDays(
  start: Date,
  workingDays: number,
  holidays: Date[] = [],
): Date {
  const holidayKeys = new Set(
    holidays.map((date) => date.toISOString().slice(0, 10)),
  );
  const cursor = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    ),
  );
  let remaining = Math.max(0, Math.floor(workingDays));
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) continue;
    if (holidayKeys.has(cursor.toISOString().slice(0, 10))) continue;
    remaining -= 1;
  }
  return cursor;
}
