"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logger } from "@/core/logger";
import { useLogoutMutation } from "../api/auth.api";
import { endClientSession } from "../utils/clear-session";

export function useAuth() {
  const dispatch = useAppDispatch();
  const [logoutMutation] = useLogoutMutation();

  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const signOut = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Always clear local state even if API call fails
    } finally {
      logger.audit("User logged out", { userId: user?.id });
      endClientSession(dispatch);
    }
  }, [dispatch, logoutMutation, user]);

  return { user, isAuthenticated, signOut };
}
