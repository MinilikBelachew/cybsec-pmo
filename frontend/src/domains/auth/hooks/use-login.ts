"use client";

import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { logger } from "@/core/logger";
import { normalizeError } from "@/core/errors/normalize-error";
import { useLoginMutation } from "../api/auth.api";
import { loginService } from "../services/auth.service";
import { type LoginFormValues } from "../schemas/auth.schema";

export function useLogin() {
  const dispatch = useAppDispatch();
  const [loginMutation, { isLoading }] = useLoginMutation();
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (values: LoginFormValues) => {
      setError(null);
      try {
        await loginService(
          (args) => loginMutation(args).unwrap(),
          values,
          dispatch,
          logger
        );
      } catch (err) {
        const normalized = normalizeError(err);
        setError(normalized.message);
        throw err;
      }
    },
    [dispatch, loginMutation]
  );

  return { login, isLoading, error };
}
