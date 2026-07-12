import { api } from "@/core/api/api";
import type { Project } from "../types/projects.types";
import type {
  InstantiateProjectTemplatePayload,
  ProjectTemplateSummary,
  SaveProjectTemplatePayload,
} from "../types/project-templates.types";

export const projectTemplatesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjectTemplates: builder.query<ProjectTemplateSummary[], void>({
      query: () => "/project-templates",
      providesTags: [{ type: "ProjectTemplates", id: "LIST" }],
    }),

    getProjectTemplate: builder.query<ProjectTemplateSummary, string>({
      query: (id) => `/project-templates/${id}`,
      providesTags: (_r, _e, id) => [{ type: "ProjectTemplates", id }],
    }),

    saveProjectAsTemplate: builder.mutation<
      ProjectTemplateSummary,
      SaveProjectTemplatePayload
    >({
      query: (body) => ({
        url: "/project-templates",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "ProjectTemplates", id: "LIST" }],
    }),

    instantiateProjectTemplate: builder.mutation<
      Project,
      { templateId: string; body: InstantiateProjectTemplatePayload }
    >({
      query: ({ templateId, body }) => ({
        url: `/project-templates/${templateId}/instantiate`,
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "ProjectTemplates", id: "LIST" },
        { type: "Projects", id: "LIST" },
        { type: "PortfolioStats", id: "SUMMARY" },
      ],
    }),
  }),
});

export const {
  useGetProjectTemplatesQuery,
  useGetProjectTemplateQuery,
  useSaveProjectAsTemplateMutation,
  useInstantiateProjectTemplateMutation,
} = projectTemplatesApi;
