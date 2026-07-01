export type RoleSortField = "code" | "label" | "isExternal" | "permissionCount" | "createdAt";
export type PermissionSortField = "module" | "action" | "recordScope";
export type AllPermissionSortField = PermissionSortField | "roleCode" | "roleLabel";

export interface RoleListItem {
  id: number;
  code: string;
  label: string;
  isExternal: boolean;
  permissionCount: number;
  createdAt: string;
}

export interface PermissionListItem {
  id: string;
  permissionId: string;
  roleId: number;
  module: string;
  action: string;
  recordScope: string | null;
  fieldScope: Record<string, unknown> | null;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface RolesQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: RoleSortField;
  sortOrder?: "asc" | "desc";
}

export interface PermissionWithRole extends PermissionListItem {
  roleCode: string;
  roleLabel: string;
}

export interface RolePermissionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: PermissionSortField;
  sortOrder?: "asc" | "desc";
}

export interface RolesResponse {
  data: RoleListItem[];
  meta: PaginatedMeta;
}

export interface RolePermissionsResponse {
  role: {
    id: number;
    code: string;
    label: string;
  };
  data: PermissionListItem[];
  meta: PaginatedMeta;
}

export interface AllPermissionsQuery {
  page?: number;
  limit?: number;
  roleId?: number;
  search?: string;
  sortBy?: AllPermissionSortField;
  sortOrder?: "asc" | "desc";
}

export interface AllPermissionsResponse {
  data: PermissionWithRole[];
  meta: PaginatedMeta;
}

export interface PermissionCatalogItem {
  id: string;
  module: string;
  action: string;
}

export interface RecordScopeOption {
  code: string;
  label: string;
}

export interface PermissionCatalogResponse {
  data: PermissionCatalogItem[];
}

export interface RecordScopesResponse {
  data: RecordScopeOption[];
}

export interface PermissionMatrixRole {
  id: number;
  code: string;
  label: string;
  isExternal: boolean;
}

export interface PermissionMatrixCell {
  roleId: number;
  granted: boolean;
  grantId?: string;
  recordScope: string | null;
}

export interface PermissionMatrixRow {
  module: string;
  action: string;
  permissionId: string;
  cells: PermissionMatrixCell[];
}

export interface PermissionMatrixResponse {
  roles: PermissionMatrixRole[];
  rows: PermissionMatrixRow[];
}

export interface GrantRolePermissionPayload {
  permissionId: string;
  recordScope: string;
  fieldScope?: Record<string, unknown> | null;
}

export interface UpdateRolePermissionPayload {
  recordScope?: string;
  fieldScope?: Record<string, unknown> | null;
}
