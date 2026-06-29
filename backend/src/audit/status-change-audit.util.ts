export function normalizeAuditStatus(status: unknown): string | null {
  if (typeof status !== 'string' || !status.trim()) {
    return null;
  }
  return status.replace(/_/g, '').toLowerCase();
}

export function resolveStatusChangeAction(
  objectType: string,
  oldValue: unknown,
  newValue: unknown,
): { action: string; newValue: unknown } | null {
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
        : `${objectType.toUpperCase()}_STATUS_CHANGED`;

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
