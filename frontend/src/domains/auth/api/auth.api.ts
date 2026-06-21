import { api } from "@/core/api/api";
import { type EntraLoginRequestDto, type LoginResponseDto } from "../types/auth.types";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    entraLogin: builder.mutation<LoginResponseDto, EntraLoginRequestDto>({
      query: (body) => ({
        url: "/auth/entra/login",
        method: "POST",
        body,
      }),
    }),

    getMe: builder.query<LoginResponseDto["user"], void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["User", "Auth"],
    }),
  }),
});

export const {
  useEntraLoginMutation,
  useGetMeQuery,
  useLogoutMutation,
} = authApi;
