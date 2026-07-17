import { UnprocessableEntityException, HttpStatus } from '@nestjs/common';
import { ApiProjectStatus } from './enums/project-api.enum';
import { RoleEnum } from '../roles/roles.enum';

/** Roles allowed to move a project from Pending Closure → Closed. */
export const PROJECT_CLOSURE_APPROVER_ROLES: string[] = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
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

export const PROJECT_CREATE_ALLOWED_STATUSES: ApiProjectStatus[] = [
  ApiProjectStatus.Draft,
];

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
  roleCode?: string,
): void {
  if (from === to) {
    return;
  }

  const allowed = getAllowedProjectStatusTransitions(from, roleCode);
  if (!allowed.includes(to)) {
    const requiresCloseAdmin =
      from === ApiProjectStatus.PendingClosure &&
      to === ApiProjectStatus.Closed;
    const requiresReopenAdmin =
      from === ApiProjectStatus.Cancelled && to === ApiProjectStatus.Active;

    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        status: requiresCloseAdmin
          ? 'statusTransitionRequiresAdminApproval'
          : requiresReopenAdmin
            ? 'statusReopenRequiresAdmin'
            : 'invalidStatusTransition',
      },
      message: requiresCloseAdmin
        ? `Only ${PROJECT_CLOSURE_APPROVER_ROLES.join(' or ')} can close a project from Pending Closure.`
        : requiresReopenAdmin
          ? `Only ${PROJECT_REOPEN_FROM_CANCELLED_ROLES.join(' or ')} can reopen a Cancelled project.`
          : `Invalid status transition from ${from} to ${to}.`,
    });
  }
}

export function assertValidProjectStatusOnCreate(status: ApiProjectStatus): void {
  if (!PROJECT_CREATE_ALLOWED_STATUSES.includes(status)) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { status: 'invalidStatusOnCreate' },
      message: 'New projects must be created in Draft status.',
    });
  }
}
