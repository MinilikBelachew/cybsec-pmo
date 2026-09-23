"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/shared/components/spinner";
import { useAppDispatch } from "@/store/hooks";
import {
  useLazyGetMeQuery,
  useLazyGetMyPermissionsQuery,
} from "@/domains/auth/api/auth.api";
import { apiUserToUser } from "@/domains/auth/transformers/auth.transformer";
import { setPermissions, setUser } from "@/domains/auth/store/auth.slice";
import {
  clearClientSession,
  redirectToLogin,
} from "@/domains/auth/utils/clear-session";

/**
 * Ensures a live server session before rendering protected UI.
 * Re-validates on bfcache restore (browser Back) so logout cannot leave
 * a stale signed-in shell visible.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const [getMe] = useLazyGetMeQuery();
  const [getPermissions] = useLazyGetMyPermissionsQuery();
  const [ready, setReady] = useState(false);

  const verifySession = useCallback(async () => {
    try {
      const apiUser = await getMe(undefined, false).unwrap();
      dispatch(setUser(apiUserToUser(apiUser)));
      try {
        const rows = await getPermissions(undefined, false).unwrap();
        dispatch(setPermissions(rows));
      } catch {
        dispatch(setPermissions([]));
      }
      setReady(true);
    } catch {
      clearClientSession(dispatch);
      redirectToLogin("session_expired");
    }
  }, [dispatch, getMe, getPermissions]);

  useEffect(() => {
    void verifySession();

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // Hide stale shell immediately while re-checking the cookie session.
      setReady(false);
      void verifySession();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [verifySession]);

  if (!ready) {
    return (
      <Spinner size="md" centered className="h-screen w-full bg-background" />
    );
  }

  return <>{children}</>;
}
