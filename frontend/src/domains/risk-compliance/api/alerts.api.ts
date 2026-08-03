import { api } from "@/core/api/api";
import type {
  AlertEvent,
  AlertRule,
  CreateAlertRulePayload,
} from "../types/alerts.types";

export const alertsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAlertCatalogue: builder.query<AlertRule[], void>({
      query: () => "/alerts/catalogue",
      providesTags: [{ type: "AlertRules", id: "LIST" }],
    }),

    createAlertRule: builder.mutation<AlertRule, CreateAlertRulePayload>({
      query: (body) => ({
        url: "/alerts/catalogue",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "AlertRules", id: "LIST" }],
    }),

    updateAlertRule: builder.mutation<
      AlertRule,
      { id: string; body: Partial<CreateAlertRulePayload> }
    >({
      query: ({ id, body }) => ({
        url: `/alerts/catalogue/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: [{ type: "AlertRules", id: "LIST" }],
    }),

    disableAlertRule: builder.mutation<void, string>({
      query: (id) => ({
        url: `/alerts/catalogue/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "AlertRules", id: "LIST" }],
    }),

    getAlertInstances: builder.query<AlertEvent[], { ruleId?: string } | void>({
      query: (params) => ({
        url: "/alerts/instances",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "AlertEvents", id: "LIST" }],
    }),

    acknowledgeAlertEvent: builder.mutation<AlertEvent, string>({
      query: (id) => ({
        url: `/alerts/instances/${id}/acknowledge`,
        method: "PATCH",
        body: {},
      }),
      invalidatesTags: [{ type: "AlertEvents", id: "LIST" }],
    }),
  }),
});

export const {
  useGetAlertCatalogueQuery,
  useCreateAlertRuleMutation,
  useUpdateAlertRuleMutation,
  useDisableAlertRuleMutation,
  useGetAlertInstancesQuery,
  useAcknowledgeAlertEventMutation,
} = alertsApi;
