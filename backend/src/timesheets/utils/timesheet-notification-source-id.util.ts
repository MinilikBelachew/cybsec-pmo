import { createHash } from 'crypto';

/** Stable UUID for notification source_object_id (column is UUID-typed). */
export function timesheetNotificationSourceObjectId(key: string): string {
  const hash = createHash('sha256').update(`timesheet:${key}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
