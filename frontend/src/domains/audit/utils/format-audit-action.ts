/** Short, scannable Action labels. Description stays the full sentence. */

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Logged in",
  LOGOUT: "Logged out",
  LOGIN_FAILED: "Login failed",
  SESSION_TIMEOUT: "Session timed out",
  REFRESH: "Session refreshed",
  UPDATE_SESSION_TIMEOUT: "Updated session timeout",
  BREAK_GLASS_ACTIVATED: "Activated break-glass",
  BREAK_GLASS_STOPPED: "Stopped break-glass",
  REVIEW_PROGRESS: "Reviewed progress",
  CREATE_DEPENDENCY: "Linked tasks",
  DELETE_DEPENDENCY: "Removed link",
  CREATE_UPLOAD: "Uploaded file",
  CREATE_TASK_ATTACHMENT: "Attached file",
  DELETE_TASK_ATTACHMENT: "Removed file",
  SET_ALLOCATION_BACKUP: "Set leave backup",
  GRANT_PERMISSION: "Granted permission",
  REVOKE_PERMISSION: "Removed permission",
  UPDATE_PERMISSION: "Updated permission",
  UPDATE_ROLE: "Updated role",
  UPDATE_AUTH: "Updated auth",
  CREATE_PROJECT: "Created project",
  UPDATE_PROJECT: "Updated project",
  DELETE_PROJECT: "Deleted project",
  CREATE_TASK: "Created task",
  UPDATE_TASK: "Updated task",
  DELETE_TASK: "Deleted task",
  PROJECT_STATUS_CHANGED: "Changed project status",
  TASK_STATUS_CHANGED: "Changed task status",
};

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

function titleCaseWords(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Action column only — never the description sentence.
 */
export function formatAuditActionLabel(
  action: string,
  objectType?: string | null,
): string {
  const key = action.trim().toUpperCase();
  if (!key) return "Action";

  if (ACTION_LABELS[key]) return ACTION_LABELS[key];

  if (HTTP_METHODS.has(key)) {
    const type = (objectType ?? "").toLowerCase();
    if (type === "auth") {
      if (key === "POST") return "Signed in";
      if (key === "PATCH" || key === "PUT") return "Updated auth";
      if (key === "DELETE") return "Signed out";
    }
    if (key === "POST") return "Created";
    if (key === "PATCH" || key === "PUT") return "Updated";
    if (key === "DELETE") return "Deleted";
    return titleCaseWords(key);
  }

  if (key.endsWith("_STATUS_CHANGED")) {
    const entity = key.replace(/_STATUS_CHANGED$/, "").replace(/_/g, " ").toLowerCase();
    return `Changed ${entity} status`;
  }
  if (key.startsWith("CREATE_")) {
    return `Created ${key.slice(7).replace(/_/g, " ").toLowerCase()}`;
  }
  if (key.startsWith("UPDATE_")) {
    return `Updated ${key.slice(7).replace(/_/g, " ").toLowerCase()}`;
  }
  if (key.startsWith("DELETE_")) {
    return `Deleted ${key.slice(7).replace(/_/g, " ").toLowerCase()}`;
  }

  return titleCaseWords(key);
}

const GENERIC_HTTP_DESCRIPTION = /^(post|patch|put|get|delete|head)\s+\w+$/i;

/**
 * Description column — keep stored detail; replace leftover "post auth" style rows.
 */
export function formatAuditDescriptionText(
  description: string | null | undefined,
  action: string,
  objectType?: string | null,
): string {
  const text = description?.trim() ?? "";
  if (text && !GENERIC_HTTP_DESCRIPTION.test(text)) {
    return text;
  }

  const key = action.trim().toUpperCase();
  const type = (objectType ?? "").toLowerCase();
  if (HTTP_METHODS.has(key) && type === "auth") {
    if (key === "POST") return "User signed in";
    if (key === "PATCH" || key === "PUT") return "Updated authentication settings";
    if (key === "DELETE") return "User signed out";
  }

  if (text) return text;
  return formatAuditActionLabel(action, objectType);
}
