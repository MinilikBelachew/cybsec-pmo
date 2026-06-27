import { api } from "@/core/api/api";

export type AuditSettings = {
  auditRetentionMonths: number;
  auditExportMaxRows: number;
  auditExportExcelJsonCellLimit: number;
  auditExportPdfJsonLimit: number;
  auditArchiveEnabled: boolean;
  lastAuditArchiveAt: string | null;
  lastAuditArchiveCount: number;
  updatedAt: string;
};

export type UpdateAuditSettingsPayload = {
  auditRetentionMonths?: number;
  auditExportMaxRows?: number;
  auditExportExcelJsonCellLimit?: number;
  auditExportPdfJsonLimit?: number;
  auditArchiveEnabled?: boolean;
};

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAuditSettings: builder.query<AuditSettings, void>({
      query: () => ({ url: "/settings/audit" }),
      providesTags: ["Settings"],
    }),

    updateAuditSettings: builder.mutation<AuditSettings, UpdateAuditSettingsPayload>({
      query: (body) => ({
        url: "/settings/audit",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Settings"],
    }),

    runAuditArchive: builder.mutation<
      { archivedCount: number; settings: AuditSettings },
      void
    >({
      query: () => ({
        url: "/settings/audit/run-archive",
        method: "PATCH",
      }),
      invalidatesTags: ["Settings", "Audit"],
    }),
  }),
});

export const {
  useGetAuditSettingsQuery,
  useUpdateAuditSettingsMutation,
  useRunAuditArchiveMutation,
} = settingsApi;
