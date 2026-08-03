import { api } from "@/core/api/api";
import type { CreateLessonPayload, Lesson } from "../types/lessons.types";

export const lessonsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLessons: builder.query<
      Lesson[],
      { category?: string; projectId?: string; q?: string; tag?: string } | void
    >({
      query: (params) => ({
        url: "/lessons",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "Lessons", id: "LIST" }],
    }),

    getSurfacedLessons: builder.query<
      Lesson[],
      { projectId?: string; category?: string; departmentId?: string } | void
    >({
      query: (params) => ({
        url: "/lessons/surface",
        params: params ?? undefined,
      }),
      providesTags: [{ type: "Lessons", id: "SURFACE" }],
    }),

    createLesson: builder.mutation<Lesson, CreateLessonPayload>({
      query: (body) => ({ url: "/lessons", method: "POST", body }),
      invalidatesTags: [
        { type: "Lessons", id: "LIST" },
        { type: "Lessons", id: "SURFACE" },
      ],
    }),

    updateLesson: builder.mutation<
      Lesson,
      { id: string; body: Partial<CreateLessonPayload> }
    >({
      query: ({ id, body }) => ({
        url: `/lessons/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: [
        { type: "Lessons", id: "LIST" },
        { type: "Lessons", id: "SURFACE" },
      ],
    }),
  }),
});

export const {
  useGetLessonsQuery,
  useGetSurfacedLessonsQuery,
  useCreateLessonMutation,
  useUpdateLessonMutation,
} = lessonsApi;
