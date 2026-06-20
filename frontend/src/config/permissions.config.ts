import { Role } from "@/core/permissions/roles";

export const permissionMap: Record<string, Role> = {
  "/dashboard": Role.VIEWER,
  "/settings": Role.ADMIN,
  "/admin": Role.SUPER_ADMIN,
};
