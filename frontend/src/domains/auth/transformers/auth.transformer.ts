import { type ApiUser, type User } from "../types/auth.types";

export const apiUserToUser = (apiUser: ApiUser): User => {
  const backendRoleCode = apiUser.roleCode || apiUser.role?.code || "engineer";

  return {
    id: apiUser.id,
    name: apiUser.displayName,
    email: apiUser.email,
    roles: [backendRoleCode],
    backendRoleCode,
    roleId: apiUser.roleId,
    breakGlass: apiUser.breakGlass === true,
  };
};
