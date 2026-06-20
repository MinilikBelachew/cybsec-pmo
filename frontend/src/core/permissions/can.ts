import { Role, ROLE_HIERARCHY } from "./roles";

/**
 * Check whether a user's role meets the minimum required role.
 */
export function can(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check whether any of a user's roles meets the minimum required role.
 */
export function canAny(userRoles: Role[], requiredRole: Role): boolean {
  return userRoles.some((role) => can(role, requiredRole));
}
