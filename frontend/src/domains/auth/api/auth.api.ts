import { api } from "@/core/api/api";
import { type LoginRequestDto, type LoginResponseDto, type RegisterRequestDto } from "../types/auth.types";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponseDto, LoginRequestDto>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
    }),

    register: builder.mutation<LoginResponseDto, RegisterRequestDto>({
      query: (body) => ({
        url: "/auth/register",
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
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useLogoutMutation,
} = authApi;
