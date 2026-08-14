import { RoleEnum } from '../roles/roles.enum';

/** Roles that may be set as escalation targets on catalogue rules. */
export const ALERT_ESCALATION_ROLE_CODES = [
  RoleEnum.pm,
  RoleEnum.pmo_lead,
  RoleEnum.team_lead,
  RoleEnum.super_admin,
  RoleEnum.it_admin,
] as const;

/** Roles that may list alert instances and acknowledge them. */
export const ALERT_INSTANCE_ROLE_CODES = [
  RoleEnum.pm,
  RoleEnum.pmo_lead,
  RoleEnum.team_lead,
  RoleEnum.super_admin,
  RoleEnum.it_admin,
] as const;

export type AlertEscalationRoleCode =
  (typeof ALERT_ESCALATION_ROLE_CODES)[number];

export function isAlertEscalationRole(code: string): boolean {
  return (ALERT_ESCALATION_ROLE_CODES as readonly string[]).includes(code);
}

export function isAlertInstanceRole(code: string | undefined | null): boolean {
  if (!code) return false;
  return (ALERT_INSTANCE_ROLE_CODES as readonly string[]).includes(code);
}
