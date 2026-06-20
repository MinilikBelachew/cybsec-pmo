import { type ApiUser, type User } from "../types/auth.types";

/**
 * Anti-Corruption Layer: maps raw backend API shape → frontend domain model.
 * If the backend renames `name` to `full_name`, only this file needs updating.
 */
export const apiUserToUser = (apiUser: ApiUser): User => ({
  id: apiUser.id,
  name: apiUser.name,
  email: apiUser.email,
  roles: apiUser.roles,
});
