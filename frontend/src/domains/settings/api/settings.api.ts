import { api } from "@/core/api/api";
import type {
  AuditSettings,
  UpdateAuditSettingsPayload,
  AllocationPolicies,
  UpdateAllocationPoliciesPayload,
  SessionSecuritySettings,
  UpdateSessionSecurityPayload,
  TimesheetEscalationSettings,
  UpdateTimesheetEscalationPayload,
} from "../types/settings.types";

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

    getAllocationPolicies: builder.query<AllocationPolicies, void>({
      query: () => ({ url: "/settings/allocation-policies" }),
      providesTags: ["Settings"],
    }),

    updateAllocationPolicies: builder.mutation<
      AllocationPolicies,
      UpdateAllocationPoliciesPayload
    >({
      query: (body) => ({
        url: "/settings/allocation-policies",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Settings", "TeamDirectory", "ProjectTeam"],
    }),

    getSessionSecuritySettings: builder.query<SessionSecuritySettings, void>({
      query: () => ({ url: "/settings/session-security" }),
      providesTags: ["Settings"],
    }),

    updateSessionSecuritySettings: builder.mutation<
      SessionSecuritySettings,
      UpdateSessionSecurityPayload
    >({
      query: (body) => ({
        url: "/settings/session-security",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Settings", "Auth"],
    }),

    getTimesheetEscalationSettings: builder.query<TimesheetEscalationSettings, void>({
      query: () => ({ url: "/settings/timesheet-escalation" }),
      providesTags: ["Settings"],
    }),

    updateTimesheetEscalationSettings: builder.mutation<
      TimesheetEscalationSettings,
      UpdateTimesheetEscalationPayload
    >({
      query: (body) => ({
        url: "/settings/timesheet-escalation",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Settings", "Timesheets", "TimesheetApprovals"],
    }),
  }),
});

export const {
  useGetAuditSettingsQuery,
  useUpdateAuditSettingsMutation,
  useRunAuditArchiveMutation,
  useGetAllocationPoliciesQuery,
  useUpdateAllocationPoliciesMutation,
  useGetSessionSecuritySettingsQuery,
  useUpdateSessionSecuritySettingsMutation,
  useGetTimesheetEscalationSettingsQuery,
  useUpdateTimesheetEscalationSettingsMutation,
} = settingsApi;
