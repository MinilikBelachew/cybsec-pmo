export const DATA_QUALITY_FLAG_TYPE = {
  MISSING_TIMESHEET: 'MISSING_TIMESHEET',
  UNAPPROVED_TIMESHEET: 'UNAPPROVED_TIMESHEET',
  STALE_INTEGRATION: 'STALE_INTEGRATION',
  INCOMPLETE_PROJECT: 'INCOMPLETE_PROJECT',
  /** UC-15 / M5.2-05 — approved hours with zero/missing rate */
  COST_MISSING_RATE: 'COST_MISSING_RATE',
  /** UC-15 / M5.2-05 — rate jump vs prior period */
  COST_RATE_JUMP: 'COST_RATE_JUMP',
  /** UC-15 / M5.2-05 — overtime spike vs regular hours */
  COST_OT_SPIKE: 'COST_OT_SPIKE',
} as const;

export type DataQualityFlagType =
  (typeof DATA_QUALITY_FLAG_TYPE)[keyof typeof DATA_QUALITY_FLAG_TYPE];

export const DATA_QUALITY_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const KEKA_INTEGRATION_FLAG_ID = '00000000-0000-0000-0000-000000000003';

/** Rate increase vs prior period that counts as an anomaly (percent). */
export const COST_ANOMALY_RATE_JUMP_PCT = 50;

/** OT hours / regular hours ratio that counts as a spike. */
export const COST_ANOMALY_OT_SPIKE_RATIO = 0.5;

/** Absolute OT hours treated as a spike when regular hours are zero. */
export const COST_ANOMALY_OT_SPIKE_MIN_HOURS = 20;

/** How many recent cost months to scan for anomalies. */
export const COST_ANOMALY_LOOKBACK_MONTHS = 3;