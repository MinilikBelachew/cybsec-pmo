import { api } from "@/core/api/api";
import type {
  CreateEscalationPayload,
  Escalation,
} from "../types/escalations.types";

export const escalationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEscalations: builder.query<
      Escalation[],
      { customerId?: string; status?: string; severity?: string } | void
    >({
      query: (params) => ({
        url: "/escalations",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "Escalations", id: "LIST" }],
    }),

    createEscalation: builder.mutation<Escalation, CreateEscalationPayload>({
      query: (body) => ({ url: "/escalations", method: "POST", body }),
      invalidatesTags: [
        { type: "Escalations", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    addEscalationCommunication: builder.mutation<
      Escalation,
      { id: string; channel: string; content: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/escalations/${id}/communication`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Escalations", id: "LIST" }],
    }),

    closeEscalation: builder.mutation<
      Escalation,
      { id: string; resolutionSummary: string }
    >({
      query: ({ id, resolutionSummary }) => ({
        url: `/escalations/${id}/close`,
        method: "PATCH",
        body: { resolutionSummary },
      }),
      invalidatesTags: [
        { type: "Escalations", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetEscalationsQuery,
  useCreateEscalationMutation,
  useAddEscalationCommunicationMutation,
  useCloseEscalationMutation,
} = escalationsApi;
