import { Prisma } from '@prisma/client';
import { toCaslAction, toCaslSubject } from './casl.constants';
import { CaslAction, CaslUserContext, PermissionRow } from './casl.types';

const DENIED: Prisma.ProjectWhereInput = { id: '__casl_denied__' };

function mergeOr<T extends Prisma.ProjectWhereInput | Prisma.TaskWhereInput>(
  clauses: T[],
): T {
  if (clauses.length === 0) {
    return { id: '__casl_denied__' } as T;
  }
  if (clauses.length === 1) {
    return clauses[0];
  }
  return { OR: clauses } as unknown as T;
}

export function projectWhereClausesForScope(
  user: CaslUserContext,
  scope: string,
): Prisma.ProjectWhereInput[] {
  switch (scope) {
    case 'own_projects':
      return [
        { primaryPmId: user.id },
        { secondaryPmId: user.id },
      ];
    case 'department':
      return user.departmentId
        ? [{ departmentId: user.departmentId }]
        : [DENIED];
    case 'shared':
      return [
        {
          customer: { contacts: { some: { userId: user.id } } },
        },
      ];
    case 'assigned':
      return [
        { primaryPmId: user.id },
        { secondaryPmId: user.id },
        { tasks: { some: { ownerId: user.id } } },
        {
          allocations: { some: { employee: { userId: user.id } } },
        },
      ];
    case 'team':
      return [
        { primaryPmId: user.id },
        { secondaryPmId: user.id },
        {
          allocations: { some: { employee: { userId: user.id } } },
        },
        {
          allocations: {
            some: { employee: { manager: { userId: user.id } } },
          },
        },
      ];
    default:
      return [];
  }
}

export function taskWhereClausesForScope(
  user: CaslUserContext,
  scope: string,
): Prisma.TaskWhereInput[] {
  switch (scope) {
    case 'assigned':
      return [{ ownerId: user.id }];
    case 'own_projects':
      return [
        { project: { primaryPmId: user.id } },
        { project: { secondaryPmId: user.id } },
      ];
    case 'shared':
      return [
        {
          project: {
            customer: { contacts: { some: { userId: user.id } } },
          },
        },
      ];
    case 'team':
      return [
        { ownerId: user.id },
        { project: { primaryPmId: user.id } },
        { project: { secondaryPmId: user.id } },
        {
          owner: { employees: { manager: { userId: user.id } } },
        },
      ];
    case 'department':
      return user.departmentId
        ? [{ project: { departmentId: user.departmentId } }]
        : [{ id: '__casl_denied__' }];
    default:
      return [];
  }
}

function collectEntityWhere<T extends Prisma.ProjectWhereInput | Prisma.TaskWhereInput>(
  permissions: PermissionRow[],
  user: CaslUserContext,
  action: CaslAction,
  subject: 'Project' | 'Task',
  clausesForScope: (user: CaslUserContext, scope: string) => T[],
): T {
  const clauses: T[] = [];
  const seenScopes = new Set<string>();

  for (const permission of permissions) {
    if (toCaslSubject(permission.module) !== subject) {
      continue;
    }
    if (toCaslAction(permission.action) !== action) {
      continue;
    }

    const scope = permission.recordScope ?? 'all';
    if (scope === 'all') {
      return {} as T;
    }
    if (seenScopes.has(scope)) {
      continue;
    }
    seenScopes.add(scope);
    clauses.push(...clausesForScope(user, scope));
  }

  return mergeOr(clauses);
}

export function buildProjectWhere(
  permissions: PermissionRow[],
  user: CaslUserContext,
  action: CaslAction,
): Prisma.ProjectWhereInput {
  return collectEntityWhere(
    permissions,
    user,
    action,
    'Project',
    projectWhereClausesForScope,
  );
}

export function buildTaskWhere(
  permissions: PermissionRow[],
  user: CaslUserContext,
  action: CaslAction,
): Prisma.TaskWhereInput {
  return collectEntityWhere(
    permissions,
    user,
    action,
    'Task',
    taskWhereClausesForScope,
  );
}
