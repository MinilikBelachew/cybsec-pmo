import { Prisma } from '@prisma/client';
import { toCaslAction, toCaslSubject } from './casl.constants';
import {
  getProjectClausesForScope,
  getTaskClausesForScope,
  RECORD_SCOPE_ALL,
} from './record-scope.registry';
import { CaslAction, CaslUserContext, PermissionRow } from './casl.types';

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

    const scope = permission.recordScope ?? RECORD_SCOPE_ALL;
    if (scope === RECORD_SCOPE_ALL) {
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
    (scopeUser, scope) => getProjectClausesForScope(scope, scopeUser) as Prisma.ProjectWhereInput[],
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
    (scopeUser, scope) => getTaskClausesForScope(scope, scopeUser) as Prisma.TaskWhereInput[],
  );
}
