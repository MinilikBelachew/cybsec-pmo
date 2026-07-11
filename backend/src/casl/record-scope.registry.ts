import { Prisma } from '@prisma/client';
import { CaslUserContext } from './casl.types';

export const RECORD_SCOPE_ALL = 'all' as const;

export const RECORD_SCOPE_CODES = [
  RECORD_SCOPE_ALL,
  'own_projects',
  'department',
  'shared',
  'assigned',
  'team',
] as const;

export type RecordScopeCode = (typeof RECORD_SCOPE_CODES)[number];

const DENIED_PROJECT: Prisma.ProjectWhereInput = { id: '__casl_denied__' };
const DENIED_TASK: Prisma.TaskWhereInput = { id: '__casl_denied__' };

export const RECORD_SCOPE_LABELS: Record<RecordScopeCode, string> = {
  all: 'All records',
  own_projects: 'Own projects (primary/secondary PM)',
  department: 'Same department',
  shared: 'Explicitly shared (customer contact)',
  assigned: 'Assigned (PM, task owner, or allocation)',
  team: 'Team (reports + project allocations)',
};

type ScopeClauseBuilders = {
  project: (user: CaslUserContext) => Prisma.ProjectWhereInput[];
  task: (user: CaslUserContext) => Prisma.TaskWhereInput[];
};

const RECORD_SCOPE_REGISTRY: Record<RecordScopeCode, ScopeClauseBuilders> = {
  all: {
    project: () => [],
    task: () => [],
  },
  own_projects: {
    project: (user) => [
      { primaryPmId: user.id },
      { secondaryPmId: user.id },
    ],
    task: (user) => [
      { project: { primaryPmId: user.id } },
      { project: { secondaryPmId: user.id } },
    ],
  },
  department: {
    project: (user) =>
      user.departmentId
        ? [{ departmentId: user.departmentId }]
        : [DENIED_PROJECT],
    task: (user) =>
      user.departmentId
        ? [{ project: { departmentId: user.departmentId } }]
        : [DENIED_TASK],
  },
  shared: {
    project: (user) => [
      {
        customer: { contacts: { some: { userId: user.id } } },
      },
    ],
    task: (user) => [
      {
        project: {
          customer: { contacts: { some: { userId: user.id } } },
        },
      },
    ],
  },
  assigned: {
    project: (user) => [
      { primaryPmId: user.id },
      { secondaryPmId: user.id },
      { tasks: { some: { ownerId: user.id } } },
      {
        allocations: { some: { employee: { userId: user.id } } },
      },
    ],
    // Own tasks + children of own parents (sub-tasks often have no owner until assigned).
    task: (user) => [
      { ownerId: user.id },
      { parentTask: { ownerId: user.id } },
    ],
  },
  team: {
    project: (user) => [
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
    ],
    task: (user) => [
      { ownerId: user.id },
      { parentTask: { ownerId: user.id } },
      { project: { primaryPmId: user.id } },
      { project: { secondaryPmId: user.id } },
      {
        owner: { employees: { manager: { userId: user.id } } },
      },
    ],
  },
};

export function isKnownRecordScope(scope: string | null | undefined): scope is RecordScopeCode {
  if (!scope) {
    return false;
  }
  return (RECORD_SCOPE_CODES as readonly string[]).includes(scope);
}

export function getProjectClausesForScope(
  scope: string,
  user: CaslUserContext,
): Prisma.ProjectWhereInput[] {
  if (!isKnownRecordScope(scope)) {
    return [];
  }
  return RECORD_SCOPE_REGISTRY[scope].project(user);
}

export function getTaskClausesForScope(
  scope: string,
  user: CaslUserContext,
): Prisma.TaskWhereInput[] {
  if (!isKnownRecordScope(scope)) {
    return [];
  }
  return RECORD_SCOPE_REGISTRY[scope].task(user);
}
