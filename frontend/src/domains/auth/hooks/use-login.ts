"use client";

import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { logger } from "@/core/logger";
import { normalizeError } from "@/core/errors/normalize-error";
import { useEntraLoginMutation } from "../api/auth.api";
import { entraLoginService } from "../services/auth.service";

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
        const normalized = normalizeError(err);
        setError(normalized.message);
        throw err;
      }
    },
    [dispatch, entraLoginMutation]
  );

  return { loginWithToken, isLoading, error };
}
