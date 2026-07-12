"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { useLazyGetMeQuery, useLazyGetMyPermissionsQuery } from "@/domains/auth/api/auth.api";
import { apiUserToUser } from "@/domains/auth/transformers/auth.transformer";
import { setPermissions, setUser } from "@/domains/auth/store/auth.slice";

/** Loads user + permissions when a session cookie exists. */
export function AuthHydrator() {
  const dispatch = useAppDispatch();
  const [getMe] = useLazyGetMeQuery();
  const [getPermissions] = useLazyGetMyPermissionsQuery();

  useEffect(() => {
    let cancelled = false;

    // Always force-refetch permissions on mount so matrix grants (e.g. Save as template)
    // appear without requiring a full logout after RBAC changes.
    getMe()
      .unwrap()
      .then(async (apiUser) => {
        if (cancelled) return;
        dispatch(setUser(apiUserToUser(apiUser)));
        try {
          const rows = await getPermissions(undefined, false).unwrap();
          if (!cancelled) dispatch(setPermissions(rows));
        } catch {
          if (!cancelled) dispatch(setPermissions([]));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [dispatch, getMe, getPermissions]);

  return null;
}
