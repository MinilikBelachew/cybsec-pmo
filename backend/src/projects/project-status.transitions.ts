import { UnprocessableEntityException, HttpStatus } from '@nestjs/common';
import { ApiProjectStatus } from './enums/project-api.enum';
import { RoleEnum } from '../roles/roles.enum';

/** Roles allowed to move a project from Pending Closure → Closed. */
export const PROJECT_CLOSURE_APPROVER_ROLES: string[] = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.sdm,
];

/** Roles allowed to reopen a Cancelled project → Active (mistakes / UAT undo). */
export const PROJECT_REOPEN_FROM_CANCELLED_ROLES: string[] = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
];

/**
 * Controlled project lifecycle transitions (Gate 1 / M1.2).
 * Terminal for most users: Closed, Cancelled.
 * Cancelled → Active is admin-only (see getAllowedProjectStatusTransitions).
 */
export const PROJECT_STATUS_TRANSITIONS: Record<
  ApiProjectStatus,
  ApiProjectStatus[]
> = {
  [ApiProjectStatus.Draft]: [ApiProjectStatus.Active, ApiProjectStatus.Cancelled],
  [ApiProjectStatus.Active]: [
    ApiProjectStatus.OnHold,
    ApiProjectStatus.AtRisk,
    ApiProjectStatus.PendingClosure,
    ApiProjectStatus.Cancelled,
  ],
  [ApiProjectStatus.OnHold]: [
    ApiProjectStatus.Active,
    ApiProjectStatus.Cancelled,
  ],
  [ApiProjectStatus.AtRisk]: [
    ApiProjectStatus.Active,
    ApiProjectStatus.OnHold,
    ApiProjectStatus.PendingClosure,
    ApiProjectStatus.Cancelled,
  ],
  [ApiProjectStatus.PendingClosure]: [
    ApiProjectStatus.Closed,
    ApiProjectStatus.Active,
  ],
  [ApiProjectStatus.Closed]: [],
  // Base list is empty; Active is injected only for reopen roles.
  [ApiProjectStatus.Cancelled]: [],
};

export const PROJECT_CREATE_ALLOWED_STATUSES: ApiProjectStatus[] =
  Object.values(ApiProjectStatus);

export function getAllowedProjectStatusTransitions(
  from: ApiProjectStatus,
  roleCode?: string,
): ApiProjectStatus[] {
  const base = PROJECT_STATUS_TRANSITIONS[from] ?? [];

  if (from === ApiProjectStatus.PendingClosure) {
    const canClose =
      roleCode && PROJECT_CLOSURE_APPROVER_ROLES.includes(roleCode);
    return base.filter(
      (status) =>
        status !== ApiProjectStatus.Closed || Boolean(canClose),
    );
  }

  if (from === ApiProjectStatus.Cancelled) {
    const canReopen =
      roleCode && PROJECT_REOPEN_FROM_CANCELLED_ROLES.includes(roleCode);
    return canReopen ? [ApiProjectStatus.Active] : [];
  }

  return base;
}

export function assertValidProjectStatusTransition(
  from: ApiProjectStatus,
  to: ApiProjectStatus,
  _roleCode?: string,
): void {
  if (from === to) {
    return;
  }

  if (!Object.values(ApiProjectStatus).includes(to)) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { status: 'invalidStatusTransition' },
      message: `Invalid project status ${to}.`,
    });
  }
}

export function assertValidProjectStatusOnCreate(status: ApiProjectStatus): void {
  if (!PROJECT_CREATE_ALLOWED_STATUSES.includes(status)) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { status: 'invalidStatusOnCreate' },
      message: 'Status must be a valid project status.',
    });
  }
}
