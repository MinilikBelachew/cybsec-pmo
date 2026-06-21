import { type ApiUser, type User } from "../types/auth.types";

export const apiUserToUser = (apiUser: ApiUser): User => {
  let roleCode = apiUser.roleCode || apiUser.role?.code || "member";
  
  // Normalize backend database role codes to frontend-friendly ones
  if (roleCode === "pm") {
    roleCode = "project_manager";
  } else if (roleCode === "engineer") {
    roleCode = "member";
  } else if (roleCode === "it_admin") {
    roleCode = "super_admin";
  } else if (roleCode === "sales") {
    roleCode = "member";
  }

  return {
    id: apiUser.id,
    name: apiUser.displayName,
    email: apiUser.email,
    roles: [roleCode],
  };
};
