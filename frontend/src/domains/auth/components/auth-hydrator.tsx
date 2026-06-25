"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useLazyGetMeQuery, useLazyGetMyPermissionsQuery } from "@/domains/auth/api/auth.api";
import { apiUserToUser } from "@/domains/auth/transformers/auth.transformer";
import { setPermissions, setUser } from "@/domains/auth/store/auth.slice";

/** Loads user + permissions when a session cookie exists. */
export function AuthHydrator() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const permissionsLoaded = useAppSelector((s) => s.auth.permissionsLoaded);
  const [getMe] = useLazyGetMeQuery();
  const [getPermissions] = useLazyGetMyPermissionsQuery();

  useEffect(() => {
    if (user && permissionsLoaded) return;

    getMe()
      .unwrap()
      .then(async (apiUser) => {
        dispatch(setUser(apiUserToUser(apiUser)));
        try {
          const rows = await getPermissions().unwrap();
          dispatch(setPermissions(rows));
        } catch {
          dispatch(setPermissions([]));
        }
      })
      .catch(() => undefined);
  }, [dispatch, getMe, getPermissions, permissionsLoaded, user]);

  return null;
}
