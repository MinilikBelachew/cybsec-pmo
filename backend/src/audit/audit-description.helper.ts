/**
 * Human-readable audit descriptions — names only, never raw UUIDs.
 */

type DescriptionInput = {
  action: string;
  objectType: string;
  objectId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export function generateAuditDescription(input: DescriptionInput): string {
  const { action, objectType, oldValue, newValue } = input;
  const subject = resolveSubject(objectType, newValue, oldValue);
  const project = resolveProjectName(newValue, oldValue);
  const onProject = project ? ` on project "${project}"` : '';
  const toProject = project ? ` to project "${project}"` : '';
  const fromProject = project ? ` from project "${project}"` : '';

  if (action === 'LOGIN') return 'User logged in';
  if (action === 'LOGOUT') return 'User logged out';
  if (action === 'REFRESH') return 'Session refreshed';
  if (action === 'CREATE_UPLOAD') {
    return subject ? `Uploaded file "${subject}"` : 'Uploaded a file';
  }

  if (action === 'SET_ALLOCATION_BACKUP') {
    return describeAllocationBackup(oldValue, newValue, onProject);
  }

  if (action === 'REVIEW_PROGRESS') {
    return subject
      ? `Reviewed progress on task "${subject}"${onProject}`
      : `Reviewed a progress update${onProject}`;
  }

  if (action === 'CREATE_DEPENDENCY') {
    const pred = extractNestedName(newValue, ['predecessor', 'predecessorTask']);
    const succ = extractNestedName(newValue, ['successor', 'successorTask']);
    if (pred && succ) return `Linked task "${pred}" → "${succ}"${onProject}`;
    return `Created a task dependency${onProject}`;
  }

  if (action === 'DELETE_DEPENDENCY') {
    const pred = extractNestedName(oldValue, ['predecessor', 'predecessorTask']);
    const succ = extractNestedName(oldValue, ['successor', 'successorTask']);
    if (pred && succ) return `Removed dependency "${pred}" → "${succ}"${onProject}`;
    return `Removed a task dependency${onProject}`;
  }

  if (action === 'CREATE_TASK_ATTACHMENT') {
    return subject
      ? `Attached file "${subject}" to a task${onProject}`
      : `Attached a file to a task${onProject}`;
  }

  if (action === 'DELETE_TASK_ATTACHMENT') {
    return subject
      ? `Removed file "${subject}" from a task${onProject}`
      : `Removed a task attachment${onProject}`;
  }

  if (action.endsWith('_STATUS_CHANGED') || action.includes('STATUS_CHANGED')) {
    const from =
      extractStatusTransition(newValue)?.from ?? extractStatus(oldValue);
    const to = extractStatusTransition(newValue)?.to ?? extractStatus(newValue);
    const label = friendlyType(objectType);
    if (subject && from && to) {
      return `Changed ${label} "${subject}" status from ${friendlyStatus(from)} to ${friendlyStatus(to)}${onProject}`;
    }
    if (from && to) {
      return `Changed ${label} status from ${friendlyStatus(from)} to ${friendlyStatus(to)}${onProject}`;
    }
    return subject
      ? `Changed status of ${label} "${subject}"${onProject}`
      : `Changed ${label} status${onProject}`;
  }

  if (action.startsWith('CREATE_')) {
    if (objectType === 'Allocation') {
      return describeAllocationCreate(newValue, toProject);
    }
    if (objectType === 'ActionPoint') {
      const owner = extractOwnerName(newValue);
      if (subject && owner) {
        return `Created action point "${subject}" for ${owner}${onProject}`;
      }
      return subject
        ? `Created action point "${subject}"${onProject}`
        : `Created an action point${onProject}`;
    }
    if (objectType === 'ProjectPhase') {
      return subject
        ? `Created phase "${subject}"${onProject}`
        : `Created a project phase${onProject}`;
    }
    if (objectType === 'ProjectMilestone') {
      return subject
        ? `Created milestone "${subject}"${onProject}`
        : `Created a project milestone${onProject}`;
    }
    if (objectType === 'Task') {
      return subject
        ? `Created task "${subject}"${onProject}`
        : `Created a task${onProject}`;
    }
    if (objectType === 'Project') {
      return subject ? `Created project "${subject}"` : 'Created a project';
    }
    if (objectType === 'TaskComment') {
      return subject
        ? `Added a comment on task "${subject}"${onProject}`
        : `Added a comment${onProject}`;
    }
    const label = friendlyType(objectType);
    return subject ? `Created ${label} "${subject}"${onProject}` : `Created a ${label}${onProject}`;
  }

  if (action.startsWith('UPDATE_')) {
    if (objectType === 'Allocation') {
      if (backupEmployeeChanged(oldValue, newValue)) {
        return describeAllocationBackup(oldValue, newValue, onProject);
      }
      const person = resolveSubject('Allocation', newValue, oldValue);
      const role = extractField(newValue, 'role') ?? extractField(oldValue, 'role');
      const changed = summarizeChangedFields(oldValue, newValue);
      if (person && changed.length > 0) {
        return `Updated ${person}'s team allocation${onProject} — changed ${changed.join(', ')}`;
      }
      if (person && role) {
        return `Updated ${person}'s allocation (${role})${onProject}`;
      }
      return person
        ? `Updated ${person}'s team allocation${onProject}`
        : `Updated a team allocation${onProject}`;
    }
    if (objectType === 'ActionPoint') {
      const rename = describeNamedEntityUpdate(
        'action point',
        'title',
        oldValue,
        newValue,
        onProject,
      );
      if (rename) return rename;
      return subject
        ? `Updated action point "${subject}"${onProject}`
        : `Updated an action point${onProject}`;
    }
    if (objectType === 'ProjectPhase') {
      return (
        describeNamedEntityUpdate('phase', 'name', oldValue, newValue, onProject) ??
        (subject
          ? `Updated phase "${subject}"${onProject}`
          : `Updated a phase${onProject}`)
      );
    }
    if (objectType === 'ProjectMilestone') {
      return (
        describeNamedEntityUpdate(
          'milestone',
          'title',
          oldValue,
          newValue,
          onProject,
        ) ??
        (subject
          ? `Updated milestone "${subject}"${onProject}`
          : `Updated a milestone${onProject}`)
      );
    }
    const label = friendlyType(objectType);
    const changed = summarizeChangedFields(oldValue, newValue);
    if (subject && changed.length > 0) {
      return `Updated ${label} "${subject}"${onProject} — changed ${changed.join(', ')}`;
    }
    return subject
      ? `Updated ${label} "${subject}"${onProject}`
      : `Updated a ${label}${onProject}`;
  }

  if (action.startsWith('DELETE_')) {
    if (objectType === 'Allocation') {
      const person = resolveSubject('Allocation', oldValue, newValue);
      return person
        ? `Removed ${person} from the project team${fromProject}`
        : `Removed a team member${fromProject}`;
    }
    if (objectType === 'ActionPoint') {
      return subject
        ? `Deleted action point "${subject}"${onProject}`
        : `Deleted an action point${onProject}`;
    }
    const label = friendlyType(objectType);
    return subject
      ? `Deleted ${label} "${subject}"${onProject}`
      : `Deleted a ${label}${onProject}`;
  }

  const label = friendlyType(objectType);
  return subject
    ? `${friendlyAction(action)} ${label} "${subject}"${onProject}`
    : `${friendlyAction(action)} ${label}${onProject}`;
}

function describeNamedEntityUpdate(
  label: string,
  nameKey: 'name' | 'title',
  oldValue: unknown,
  newValue: unknown,
  onProject: string,
): string | null {
  const oldName = extractField(oldValue, nameKey);
  const newName = extractField(newValue, nameKey);
  const otherChanges = summarizeChangedFields(oldValue, newValue).filter(
    (field) => field !== nameKey && field !== 'project name',
  );

  if (oldName && newName && oldName !== newName) {
    if (otherChanges.length > 0) {
      return `Renamed ${label} from "${oldName}" to "${newName}"${onProject} — also changed ${otherChanges.join(', ')}`;
    }
    return `Renamed ${label} from "${oldName}" to "${newName}"${onProject}`;
  }

  const currentName = newName ?? oldName;
  if (currentName && otherChanges.length > 0) {
    return `Updated ${label} "${currentName}"${onProject} — changed ${otherChanges.join(', ')}`;
  }

  return null;
}

function describeAllocationCreate(newValue: unknown, toProject: string): string {
  const people = collectAllocationPeople(newValue);
  if (people.length === 0) {
    return `Added a team member${toProject}`;
  }
  if (people.length === 1) {
    const { name, role } = people[0];
    return role
      ? `Allocated ${name} as ${role}${toProject}`
      : `Allocated ${name}${toProject}`;
  }
  if (people.length <= 3) {
    return `Allocated ${people.map((p) => p.name).join(', ')}${toProject}`;
  }
  return `Allocated ${people.length} team members${toProject}`;
}

function backupEmployeeChanged(oldValue: unknown, newValue: unknown): boolean {
  const before = resolveBackupName(oldValue) ?? extractField(oldValue, 'backupEmployeeId');
  const after = resolveBackupName(newValue) ?? extractField(newValue, 'backupEmployeeId');
  const beforeId = extractBackupId(oldValue);
  const afterId = extractBackupId(newValue);
  return before !== after || beforeId !== afterId;
}

function describeAllocationBackup(
  oldValue: unknown,
  newValue: unknown,
  onProject: string,
): string {
  const member =
    resolveSubject('Allocation', newValue, oldValue) ?? 'a team member';
  const previousBackup = resolveBackupName(oldValue);
  const nextBackup = resolveBackupName(newValue);
  const previousId = extractBackupId(oldValue);
  const nextId = extractBackupId(newValue);

  if (!nextId && (previousId || previousBackup)) {
    return previousBackup
      ? `Removed ${previousBackup} as leave backup for ${member}${onProject}`
      : `Cleared leave backup for ${member}${onProject}`;
  }

  if (nextBackup) {
    if (previousBackup && previousBackup !== nextBackup) {
      return `Changed leave backup for ${member} from ${previousBackup} to ${nextBackup}${onProject}`;
    }
    return `Set ${nextBackup} as leave backup for ${member}${onProject}`;
  }

  if (nextId && !nextBackup) {
    return `Updated leave backup for ${member}${onProject}`;
  }

  return `Updated leave backup for ${member}${onProject}`;
}

function resolveBackupName(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    const backup = row.backupEmployee;
    if (backup && typeof backup === 'object') {
      const name =
        (backup as { name?: unknown; displayName?: unknown }).name ??
        (backup as { displayName?: unknown }).displayName;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    if (typeof row.backupEmployeeName === 'string' && row.backupEmployeeName.trim()) {
      return row.backupEmployeeName.trim();
    }
  }
  return null;
}

function extractBackupId(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    if (typeof row.backupEmployeeId === 'string' && row.backupEmployeeId.trim()) {
      return row.backupEmployeeId.trim();
    }
    if (row.backupEmployeeId === null) return null;
  }
  return null;
}

function collectAllocationPeople(
  value: unknown,
): Array<{ name: string; role: string | null }> {
  const rows = normalizeRows(value);
  const people: Array<{ name: string; role: string | null }> = [];
  for (const row of rows) {
    const name = resolveSubject('Allocation', row, null);
    if (!name) continue;
    people.push({ name, role: extractField(row, 'role') });
  }
  return people;
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((v) => v && typeof v === 'object') as Record<
      string,
      unknown
    >[];
  }
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.created)) {
    return normalizeRows(record.created);
  }
  return [record];
}

function resolveSubject(
  objectType: string,
  primary: unknown,
  fallback: unknown,
): string | null {
  if (objectType === 'Allocation') {
    return (
      extractEmployeeName(primary) ??
      extractEmployeeName(fallback) ??
      extractName(primary) ??
      extractName(fallback)
    );
  }
  if (objectType === 'ActionPoint') {
    return extractField(primary, 'title') ?? extractField(fallback, 'title');
  }
  if (objectType === 'ProjectMilestone') {
    return (
      extractField(primary, 'title') ??
      extractField(fallback, 'title') ??
      extractName(primary) ??
      extractName(fallback)
    );
  }
  if (objectType === 'WorkspaceDocument' || objectType === 'File') {
    return (
      extractField(primary, 'filename') ??
      extractField(primary, 'originalName') ??
      extractField(fallback, 'filename') ??
      extractField(fallback, 'originalName') ??
      extractName(primary) ??
      extractName(fallback)
    );
  }
  if (objectType === 'User') {
    return (
      extractField(primary, 'displayName') ??
      extractField(fallback, 'displayName') ??
      extractName(primary) ??
      extractName(fallback)
    );
  }
  if (objectType === 'TaskComment') {
    return (
      extractNestedName(primary, ['task']) ??
      extractNestedName(fallback, ['task']) ??
      extractName(primary) ??
      extractName(fallback)
    );
  }
  return extractName(primary) ?? extractName(fallback);
}

function resolveProjectName(...values: unknown[]): string | null {
  for (const value of values) {
    const rows = normalizeRows(value);
    for (const row of rows) {
      const nested = row.project;
      if (nested && typeof nested === 'object') {
        const name = (nested as { name?: unknown }).name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
      const projectName = row.projectName;
      if (typeof projectName === 'string' && projectName.trim()) {
        return projectName.trim();
      }
    }
  }
  return null;
}

function extractEmployeeName(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    const employee = row.employee;
    if (employee && typeof employee === 'object') {
      const name =
        (employee as { name?: unknown; displayName?: unknown }).name ??
        (employee as { displayName?: unknown }).displayName;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    if (typeof row.employeeName === 'string' && row.employeeName.trim()) {
      return row.employeeName.trim();
    }
  }
  return null;
}

function extractOwnerName(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    const owner = row.owner;
    if (owner && typeof owner === 'object') {
      const name = (owner as { displayName?: unknown; name?: unknown })
        .displayName ?? (owner as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    if (typeof row.ownerName === 'string' && row.ownerName.trim()) {
      return row.ownerName.trim();
    }
  }
  return null;
}

function extractNestedName(
  value: unknown,
  keys: string[],
): string | null {
  for (const row of normalizeRows(value)) {
    for (const key of keys) {
      const nested = row[key];
      if (nested && typeof nested === 'object') {
        const name =
          (nested as { title?: unknown; name?: unknown; displayName?: unknown })
            .title ??
          (nested as { name?: unknown }).name ??
          (nested as { displayName?: unknown }).displayName;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
  }
  return null;
}

function extractName(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    for (const key of [
      'title',
      'name',
      'displayName',
      'filename',
      'originalName',
      'code',
      'label',
    ] as const) {
      const v = row[key];
      if (typeof v === 'string' && v.trim() && !looksLikeUuid(v)) {
        return v.trim();
      }
    }
  }
  return null;
}

function extractField(value: unknown, key: string): string | null {
  for (const row of normalizeRows(value)) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() && !looksLikeUuid(v)) {
      return v.trim();
    }
  }
  return null;
}

function extractStatus(value: unknown): string | null {
  for (const row of normalizeRows(value)) {
    if (typeof row.status === 'string' && row.status.trim()) {
      return row.status.trim();
    }
  }
  return null;
}

function extractStatusTransition(
  value: unknown,
): { from?: string; to?: string } | null {
  for (const row of normalizeRows(value)) {
    const transition = row.statusTransition;
    if (!transition || typeof transition !== 'object') continue;
    const from = (transition as { from?: unknown }).from;
    const to = (transition as { to?: unknown }).to;
    return {
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    };
  }
  return null;
}

function friendlyType(objectType: string): string {
  const map: Record<string, string> = {
    Project: 'project',
    Task: 'task',
    Allocation: 'team allocation',
    ActionPoint: 'action point',
    ProjectPhase: 'phase',
    ProjectMilestone: 'milestone',
    TaskComment: 'comment',
    WorkspaceDocument: 'document',
    TaskProgressUpdate: 'progress update',
    TaskDependency: 'dependency',
    User: 'user',
    File: 'file',
  };
  return (
    map[objectType] ??
    objectType
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
  );
}

function friendlyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function friendlyAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase();
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function summarizeChangedFields(
  oldValue: unknown,
  newValue: unknown,
): string[] {
  if (
    !oldValue ||
    !newValue ||
    typeof oldValue !== 'object' ||
    typeof newValue !== 'object' ||
    Array.isArray(oldValue) ||
    Array.isArray(newValue)
  ) {
    return [];
  }

  const exclude = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'password',
    'token',
    'refreshToken',
    'statusTransition',
    'breakGlassAction',
    'employeeId',
    'projectId',
    'ownerId',
    'actorId',
    'userId',
    'backupEmployeeId',
    'backupEmployee',
    'employee',
    'project',
    'owner',
  ]);

  const oldRecord = oldValue as Record<string, unknown>;
  const newRecord = newValue as Record<string, unknown>;
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  const changed: string[] = [];

  for (const key of keys) {
    if (exclude.has(key)) continue;
    // Skip nested objects (e.g. enriched project) — they are not real field edits
    const beforeVal = oldRecord[key];
    const afterVal = newRecord[key];
    if (
      (beforeVal && typeof beforeVal === 'object') ||
      (afterVal && typeof afterVal === 'object')
    ) {
      continue;
    }
    const before = JSON.stringify(beforeVal ?? null);
    const after = JSON.stringify(afterVal ?? null);
    if (before !== after) {
      changed.push(key.replace(/([A-Z])/g, ' $1').trim().toLowerCase());
    }
    if (changed.length >= 4) break;
  }

  return changed;
}
