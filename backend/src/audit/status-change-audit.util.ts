export function normalizeAuditStatus(status: unknown): string | null {
  if (typeof status !== 'string' || !status.trim()) {
    return null;
  }
  return status.replace(/_/g, '').toLowerCase();
}

function extractId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Only rewrite CRUD actions to *_STATUS_CHANGED when old/new are clearly the
 * same entity (matching ids). Prevents nested creates (e.g. ActionPoint) from
 * being misclassified as PROJECT_STATUS_CHANGED when oldValue was a Project.
 */
export function resolveStatusChangeAction(
  objectType: string,
  oldValue: unknown,
  newValue: unknown,
): { action: string; newValue: unknown } | null {
  const oldId = extractId(oldValue);
  const newId = extractId(newValue);
  if (!oldId || !newId || oldId !== newId) {
    return null;
  }

  const fromStatus = normalizeAuditStatus(
    oldValue && typeof oldValue === 'object'
      ? (oldValue as { status?: unknown }).status
      : null,
  );
  const toStatus = normalizeAuditStatus(
    newValue && typeof newValue === 'object'
      ? (newValue as { status?: unknown }).status
      : null,
  );

  if (!fromStatus || !toStatus || fromStatus === toStatus) {
    return null;
  }

  const action =
    objectType === 'Project'
      ? 'PROJECT_STATUS_CHANGED'
      : objectType === 'Task'
        ? 'TASK_STATUS_CHANGED'
        : `${objectType.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_STATUS_CHANGED`;

  return {
    action,
    newValue: {
      ...(typeof newValue === 'object' && newValue !== null ? newValue : {}),
      statusTransition: {
        from: (oldValue as { status?: string }).status ?? fromStatus,
        to: (newValue as { status?: string }).status ?? toStatus,
      },
    },
  };
}
