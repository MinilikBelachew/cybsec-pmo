import { api } from "@/core/api/api";
import type {
  BrandingProfile,
  BrandingProfileInput,
  BrandingProfileOption,
} from "../types/branding.types";

export const brandingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBrandingProfiles: builder.query<BrandingProfile[], void>({
      query: () => ({ url: "/branding-profiles" }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "BrandingProfiles" as const,
                id,
              })),
              { type: "BrandingProfiles", id: "LIST" },
            ]
          : [{ type: "BrandingProfiles", id: "LIST" }],
    }),

    getBrandingProfileOptions: builder.query<BrandingProfileOption[], void>({
      query: () => ({ url: "/branding-profiles/options" }),
      providesTags: [{ type: "BrandingProfiles", id: "OPTIONS" }],
    }),

    createBrandingProfile: builder.mutation<
      BrandingProfile,
      BrandingProfileInput
    >({
      query: (body) => ({
        url: "/branding-profiles",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "BrandingProfiles", id: "LIST" },
        { type: "BrandingProfiles", id: "OPTIONS" },
      ],
    }),

    updateBrandingProfile: builder.mutation<
      BrandingProfile,
      { id: string; body: Partial<BrandingProfileInput> }
    >({
      query: ({ id, body }) => ({
        url: `/branding-profiles/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "BrandingProfiles", id },
        { type: "BrandingProfiles", id: "LIST" },
        { type: "BrandingProfiles", id: "OPTIONS" },
      ],
    }),

    deleteBrandingProfile: builder.mutation<void, string>({
      query: (id) => ({
        url: `/branding-profiles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "BrandingProfiles", id: "LIST" },
        { type: "BrandingProfiles", id: "OPTIONS" },
      ],
    }),

    uploadBrandingLogo: builder.mutation<
      BrandingProfile,
      { id: string; file: File }
    >({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: `/branding-profiles/${id}/logo`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "BrandingProfiles", id },
        { type: "BrandingProfiles", id: "LIST" },
      ],
    }),

    clearBrandingLogo: builder.mutation<BrandingProfile, string>({
      query: (id) => ({
        url: `/branding-profiles/${id}/logo`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "BrandingProfiles", id },
        { type: "BrandingProfiles", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetBrandingProfilesQuery,
  useGetBrandingProfileOptionsQuery,
  useCreateBrandingProfileMutation,
  useUpdateBrandingProfileMutation,
  useDeleteBrandingProfileMutation,
  useUploadBrandingLogoMutation,
  useClearBrandingLogoMutation,
} = brandingApi;
