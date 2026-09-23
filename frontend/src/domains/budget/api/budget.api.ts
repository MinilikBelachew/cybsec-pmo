import { api } from "@/core/api/api";
import type {
  CreateBudgetAdjustmentPayload,
  CreateBudgetBaselinePayload,
  CreateBudgetLineItemPayload,
  CreateBudgetRevisionPayload,
  BudgetAdjustment,
  BudgetLineItem,
  BudgetRevision,
  PortfolioBudgetRow,
  ProjectBudget,
  ResourceCostBreakdown,
  UpdateBudgetLineItemPayload,
} from "../types/budget.types";

export const budgetApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPortfolioBudgets: builder.query<PortfolioBudgetRow[], void>({
      query: () => `/budget`,
      providesTags: [{ type: "Budget", id: "PORTFOLIO" }],
    }),

    getProjectBudget: builder.query<ProjectBudget, string>({
      query: (projectId) => `/projects/${projectId}/budget`,
      providesTags: (_r, _e, projectId) => [{ type: "Budget", id: projectId }],
    }),

    getProjectResourceCosts: builder.query<
      ResourceCostBreakdown,
      { projectId: string; groupBy?: "employee" | "month" | "detail" }
    >({
      query: ({ projectId, groupBy = "detail" }) => ({
        url: `/projects/${projectId}/budget/resource-costs`,
        params: { groupBy },
      }),
      providesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: `${projectId}-resource-costs` },
      ],
    }),

    createBudgetBaseline: builder.mutation<
      ProjectBudget,
      { projectId: string; body: CreateBudgetBaselinePayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/budget/baseline`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "Projects", id: projectId },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    proposeBudgetRevision: builder.mutation<
      BudgetRevision,
      { projectId: string; body: CreateBudgetRevisionPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/budget/revisions`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
      ],
    }),

    approveBudgetRevision: builder.mutation<
      BudgetRevision,
      { projectId: string; revisionId: string }
    >({
      query: ({ projectId, revisionId }) => ({
        url: `/projects/${projectId}/budget/revisions/${revisionId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    rejectBudgetRevision: builder.mutation<
      BudgetRevision,
      { projectId: string; revisionId: string }
    >({
      query: ({ projectId, revisionId }) => ({
        url: `/projects/${projectId}/budget/revisions/${revisionId}/reject`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
      ],
    }),

    createBudgetLineItem: builder.mutation<
      BudgetLineItem,
      { projectId: string; body: CreateBudgetLineItemPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/budget/line-items`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    updateBudgetLineItem: builder.mutation<
      BudgetLineItem,
      {
        projectId: string;
        lineItemId: string;
        body: UpdateBudgetLineItemPayload;
      }
    >({
      query: ({ projectId, lineItemId, body }) => ({
        url: `/projects/${projectId}/budget/line-items/${lineItemId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    deleteBudgetLineItem: builder.mutation<
      void,
      { projectId: string; lineItemId: string }
    >({
      query: ({ projectId, lineItemId }) => ({
        url: `/projects/${projectId}/budget/line-items/${lineItemId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    proposeBudgetAdjustment: builder.mutation<
      BudgetAdjustment,
      { projectId: string; body: CreateBudgetAdjustmentPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/budget/adjustments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
      ],
    }),

    approveBudgetAdjustment: builder.mutation<
      BudgetAdjustment,
      { projectId: string; adjustmentId: string }
    >({
      query: ({ projectId, adjustmentId }) => ({
        url: `/projects/${projectId}/budget/adjustments/${adjustmentId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
        { type: "Budget", id: "PORTFOLIO" },
        { type: "PortfolioStats", id: "LIST" },
      ],
    }),

    rejectBudgetAdjustment: builder.mutation<
      BudgetAdjustment,
      { projectId: string; adjustmentId: string }
    >({
      query: ({ projectId, adjustmentId }) => ({
        url: `/projects/${projectId}/budget/adjustments/${adjustmentId}/reject`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Budget", id: projectId },
      ],
    }),

    exportBudgetFile: builder.query<
      Blob,
      { format: "xlsx" | "csv" }
    >({
      query: ({ format }) => ({
        url: "/budget/export",
        params: { format },
        responseHandler: async (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetPortfolioBudgetsQuery,
  useGetProjectBudgetQuery,
  useGetProjectResourceCostsQuery,
  useCreateBudgetBaselineMutation,
  useProposeBudgetRevisionMutation,
  useApproveBudgetRevisionMutation,
  useRejectBudgetRevisionMutation,
  useCreateBudgetLineItemMutation,
  useUpdateBudgetLineItemMutation,
  useDeleteBudgetLineItemMutation,
  useProposeBudgetAdjustmentMutation,
  useApproveBudgetAdjustmentMutation,
  useRejectBudgetAdjustmentMutation,
  useLazyExportBudgetFileQuery,
} = budgetApi;

export function downloadBudgetBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
