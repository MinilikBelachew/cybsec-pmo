import type { AuditLogEntry } from "../api/audit.api";

const NOTABLE_ACTION_PATTERNS = [
  "DELETE_",
  "GRANT_PERMISSION",
  "REVOKE_PERMISSION",
  "UPDATE_PERMISSION",
  "PROJECT_STATUS",
  "CREATE_PROJECT",
  "IMPORT",
  "EXPORT",
  "EMERGENCY",
  "BREAK_GLASS",
  "LOGIN",
  "LOGOUT",
] as const;

export function isNotableAuditAction(entry: AuditLogEntry): boolean {
  if (entry.breakGlassAction) return true;

  const action = entry.action.toUpperCase();
  return NOTABLE_ACTION_PATTERNS.some((pattern) => action.includes(pattern));
}

export function formatAuditActivityToast(entry: AuditLogEntry): string {
  const actor = entry.user?.displayName ?? "System";
  const actionLabel = entry.action.replace(/_/g, " ").toLowerCase();
  const objectHint = entry.objectType ? ` · ${entry.objectType}` : "";
  return `${actor} — ${actionLabel}${objectHint}`;
}
