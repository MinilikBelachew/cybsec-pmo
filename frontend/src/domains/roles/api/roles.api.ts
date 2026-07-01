import { api } from "@/core/api/api";
import type {
  AllPermissionsQuery,
  AllPermissionsResponse,
  GrantRolePermissionPayload,
  PermissionCatalogResponse,
  PermissionMatrixResponse,
  RecordScopesResponse,
  RolePermissionsQuery,
  RolePermissionsResponse,
  RolesQuery,
  RolesResponse,
  UpdateRolePermissionPayload,
  PermissionListItem,
} from "../types/roles.types";

function buildListParams(
  params: RolesQuery | RolePermissionsQuery | AllPermissionsQuery,
): Record<string, string | number> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };

  if (params.search?.trim()) query.search = params.search.trim();
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if ("roleId" in params && params.roleId) query.roleId = params.roleId;

  return query;
}

function patchMatrixCell(
  draft: PermissionMatrixResponse,
  roleId: number,
  permissionId: string,
  patch: Partial<PermissionMatrixResponse["rows"][number]["cells"][number]>,
) {
  const row = draft.rows.find((entry) => entry.permissionId === permissionId);
  const cell = row?.cells.find((entry) => entry.roleId === roleId);
  if (cell) {
    Object.assign(cell, patch);
  }
}

export const rolesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<RolesResponse, RolesQuery>({
      query: (params) => ({
        url: "/roles",
        params: buildListParams(params),
      }),
      providesTags: [{ type: "Roles", id: "LIST" }],
    }),

    getRolePermissions: builder.query<
      RolePermissionsResponse,
      { roleId: number } & RolePermissionsQuery
    >({
      query: ({ roleId, ...params }) => ({
        url: `/roles/${roleId}/permissions`,
        params: buildListParams(params),
      }),
      providesTags: (_result, _error, { roleId }) => [
        { type: "Roles", id: roleId },
        { type: "Permissions", id: `ROLE_${roleId}` },
      ],
    }),

    getAllPermissions: builder.query<AllPermissionsResponse, AllPermissionsQuery>({
      query: (params) => ({
        url: "/roles/permissions",
        params: buildListParams(params),
      }),
      providesTags: [{ type: "Permissions", id: "LIST" }],
    }),

    getPermissionMatrix: builder.query<PermissionMatrixResponse, void>({
      query: () => ({ url: "/roles/permissions/matrix" }),
      providesTags: [{ type: "Permissions", id: "MATRIX" }],
    }),

    getPermissionCatalog: builder.query<PermissionCatalogResponse, void>({
      query: () => ({ url: "/roles/permissions/catalog" }),
      providesTags: [{ type: "Permissions", id: "CATALOG" }],
    }),

    getRecordScopes: builder.query<RecordScopesResponse, void>({
      query: () => ({ url: "/roles/record-scopes" }),
    }),

    grantRolePermission: builder.mutation<
      PermissionListItem,
      { roleId: number; body: GrantRolePermissionPayload }
    >({
      query: ({ roleId, body }) => ({
        url: `/roles/${roleId}/permissions`,
        method: "POST",
        body,
      }),
      async onQueryStarted({ roleId, body }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          rolesApi.util.updateQueryData("getPermissionMatrix", undefined, (draft) => {
            patchMatrixCell(draft, roleId, body.permissionId, {
              granted: true,
              recordScope: body.recordScope,
              grantId: undefined,
            });
          }),
        );

        try {
          const { data } = await queryFulfilled;
          dispatch(
            rolesApi.util.updateQueryData("getPermissionMatrix", undefined, (draft) => {
              patchMatrixCell(draft, roleId, body.permissionId, {
                grantId: data.id,
                recordScope: data.recordScope,
              });
            }),
          );
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: "Roles", id: "LIST" },
        { type: "Roles", id: roleId },
        { type: "Permissions", id: "LIST" },
        { type: "Permissions", id: `ROLE_${roleId}` },
      ],
    }),

    updateRolePermission: builder.mutation<
      PermissionListItem,
      { roleId: number; grantId: string; body: UpdateRolePermissionPayload }
    >({
      query: ({ roleId, grantId, body }) => ({
        url: `/roles/${roleId}/permissions/${grantId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: "Roles", id: "LIST" },
        { type: "Roles", id: roleId },
        { type: "Permissions", id: "LIST" },
        { type: "Permissions", id: "MATRIX" },
        { type: "Permissions", id: `ROLE_${roleId}` },
      ],
    }),

    revokeRolePermission: builder.mutation<
      { success: boolean },
      { roleId: number; grantId: string }
    >({
      query: ({ roleId, grantId }) => ({
        url: `/roles/${roleId}/permissions/${grantId}`,
        method: "DELETE",
      }),
      async onQueryStarted({ roleId, grantId }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          rolesApi.util.updateQueryData("getPermissionMatrix", undefined, (draft) => {
            for (const row of draft.rows) {
              const cell = row.cells.find(
                (entry) => entry.roleId === roleId && entry.grantId === grantId,
              );
              if (cell) {
                cell.granted = false;
                cell.grantId = undefined;
                cell.recordScope = null;
                break;
              }
            }
          }),
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: "Roles", id: "LIST" },
        { type: "Roles", id: roleId },
        { type: "Permissions", id: "LIST" },
        { type: "Permissions", id: `ROLE_${roleId}` },
      ],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetRolePermissionsQuery,
  useGetAllPermissionsQuery,
  useGetPermissionMatrixQuery,
  useGetPermissionCatalogQuery,
  useGetRecordScopesQuery,
  useGrantRolePermissionMutation,
  useUpdateRolePermissionMutation,
  useRevokeRolePermissionMutation,
} = rolesApi;
