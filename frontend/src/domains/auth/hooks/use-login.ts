"use client";

import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { logger } from "@/core/logger";
import { useEntraLoginMutation } from "../api/auth.api";
import { entraLoginService } from "../services/auth.service";

type ApiErrorPayload = {
  message?: string;
  code?: string;
  retryAfter?: number;
};

function getLoginErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: ApiErrorPayload }).data;
    if (data?.code === "AUTH_RATE_LIMITED") {
      const wait = data.retryAfter ? ` Try again in ${data.retryAfter}s.` : "";
      return `Too many login requests.${wait}`;
    }
    if (data?.code === "AUTH_LOGIN_LOCKED") {
      const wait = data.retryAfter
        ? ` Try again in ${Math.ceil(data.retryAfter / 60)} minute(s).`
        : "";
      return `Too many failed login attempts. Access is temporarily locked.${wait}`;
    }
    if (data?.message) {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

export function useLogin() {
  const dispatch = useAppDispatch();
  const [entraLoginMutation, { isLoading }] = useEntraLoginMutation();
  const [error, setError] = useState<string | null>(null);

  const loginWithToken = useCallback(
    async (idToken: string) => {
      setError(null);
      try {
        await entraLoginService(
          (args) => entraLoginMutation(args).unwrap(),
          { idToken },
          dispatch,
          logger
        );
      } catch (err) {
        const message = getLoginErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    [dispatch, entraLoginMutation]
  );

  return { loginWithToken, isLoading, error };
}
