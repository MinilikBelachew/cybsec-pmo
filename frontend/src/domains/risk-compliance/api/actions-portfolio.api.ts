import { api } from "@/core/api/api";
import type { ActionPoint } from "@/domains/projects/types/action-points.types";

export type ActionClosureReport = {
  bySource: Array<{ sourceType: string; count: number }>;
  byOwner: Array<{
    ownerId: string;
    ownerName?: string;
    count: number;
  }>;
  byStatus: Array<{ status: string; count: number }>;
  total: number;
  closed: number;
  overdueOpen: number;
};

export const actionsPortfolioApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPortfolioActions: builder.query<
      ActionPoint[],
      {
        projectId?: string;
        status?: string;
        sourceType?: string;
        ownerId?: string;
      } | void
    >({
      query: (params) => ({
        url: "/actions",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "ActionPoints", id: "PORTFOLIO" }],
    }),

    getActionClosureReport: builder.query<
      ActionClosureReport,
      { projectId?: string } | void
    >({
      query: (params) => ({
        url: "/actions/closure-report",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "ActionPoints", id: "CLOSURE" }],
    }),

    sendActionReminders: builder.mutation<{ sent: number }, void>({
      query: () => ({
        url: "/actions/reminders",
        method: "POST",
      }),
      invalidatesTags: [{ type: "Notifications", id: "LIST" }],
    }),
  }),
});

export const {
  useGetPortfolioActionsQuery,
  useGetActionClosureReportQuery,
  useSendActionRemindersMutation,
} = actionsPortfolioApi;
