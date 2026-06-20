export enum Role {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  MANAGER = "manager",
  MEMBER = "member",
  VIEWER = "viewer",
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 5,
  [Role.ADMIN]: 4,
  [Role.MANAGER]: 3,
  [Role.MEMBER]: 2,
  [Role.VIEWER]: 1,
};
