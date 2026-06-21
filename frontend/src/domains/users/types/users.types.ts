export interface Role {
  code: string;
  label: string;
  isExternal: boolean;
}

export interface User {
  id: string;
  entraObjectId: string;
  email: string;
  displayName: string;
  roleCode: string;
  isActive: boolean;
  isExternal: boolean;
  role?: Role;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  entraObjectId: string;
  email: string;
  displayName: string;
  role: { code: string };
  isActive?: boolean;
  isExternal?: boolean;
}

export interface UpdateUserDto {
  displayName?: string;
  role?: { code: string };
  isActive?: boolean;
  isExternal?: boolean;
}

export interface PaginatedUsersResponse {
  data: User[];
  hasNextPage: boolean;
}
