"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logger } from "@/core/logger";
import { useLogoutMutation } from "../api/auth.api";
import { logout } from "../store/auth.slice";
import { useRouter } from "@/i18n/routing";

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logoutMutation] = useLogoutMutation();

  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const signOut = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Always clear local state even if API call fails
    } finally {
      dispatch(logout());
      logger.audit("User logged out", { userId: user?.id });
      router.push("/login");
    }
  }, [dispatch, logoutMutation, router, user]);

  return { user, isAuthenticated, signOut };
}
