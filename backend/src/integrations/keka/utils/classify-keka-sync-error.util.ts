import {
  KEKA_FAILURE_CLASS,
  type KekaFailureClass,
} from '../keka.constants';

/**
 * Classify a Keka sync error as permanent (do not auto-retry) or transient.
 * Prefer HTTP status when present in the message (e.g. "with status 400").
 */
export function classifyKekaSyncError(
  errorMsg: string,
  statusHint?: number,
): KekaFailureClass {
  const msg = (errorMsg ?? '').trim();
  const lower = msg.toLowerCase();

  const statusFromMessage = msg.match(/\bstatus\s+(\d{3})\b/i);
  const status =
    statusHint ??
    (statusFromMessage ? Number(statusFromMessage[1]) : undefined);

  if (status === 429) {
    return KEKA_FAILURE_CLASS.TRANSIENT;
  }
  if (typeof status === 'number' && status >= 500) {
    return KEKA_FAILURE_CLASS.TRANSIENT;
  }
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return KEKA_FAILURE_CLASS.PERMANENT;
  }

  if (
    /timeout|timed out|econnreset|econnrefused|enotfound|network|temporar|rate.?limit|too many requests|503|502|504|socket hang up/i.test(
      lower,
    )
  ) {
    return KEKA_FAILURE_CLASS.TRANSIENT;
  }

  if (
    /validation|invalid|unauthorized|forbidden|not found|not linked|missing (required|field|name|currency|employee)|billingcurrency|cannot map|no keka|already exists|bad request|unprocessable/i.test(
      lower,
    )
  ) {
    return KEKA_FAILURE_CLASS.PERMANENT;
  }

  return KEKA_FAILURE_CLASS.TRANSIENT;
}
