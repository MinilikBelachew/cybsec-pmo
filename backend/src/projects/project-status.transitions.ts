import { UnprocessableEntityException, HttpStatus } from '@nestjs/common';
import { ApiProjectStatus } from './enums/project-api.enum';
import { RoleEnum } from '../roles/roles.enum';

/** Roles allowed to move a project from Pending Closure → Closed. */
export const PROJECT_CLOSURE_APPROVER_ROLES: string[] = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
];

/**
 * Controlled project lifecycle transitions (Gate 1 / M1.2).
 * Terminal states: Closed, Cancelled.
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
    const requiresAdmin =
      from === ApiProjectStatus.PendingClosure &&
      to === ApiProjectStatus.Closed;

    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        status: requiresAdmin
          ? 'statusTransitionRequiresAdminApproval'
          : 'invalidStatusTransition',
      },
      message: requiresAdmin
        ? `Only ${PROJECT_CLOSURE_APPROVER_ROLES.join(' or ')} can close a project from Pending Closure.`
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
