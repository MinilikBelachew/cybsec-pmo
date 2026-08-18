"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLazyGetMeQuery, useLazyGetMyPermissionsQuery } from "../api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { apiUserToUser } from "../transformers/auth.transformer";
import { setPermissions, setUser } from "../store/auth.slice";
import { normalizeReturnPath } from "@/shared/utils/return-path";
import { isSessionEnded, redirectToLogin } from "../utils/clear-session";

function replaceAppPath(path: string) {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const locale = segments[0] || "en";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.replace(`/${locale}${normalized}`);
}

export function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [getMe] = useLazyGetMeQuery();
  const [getPermissions] = useLazyGetMyPermissionsQuery();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    if (isSessionEnded()) {
      redirectToLogin("session_expired");
      return;
    }

    const error = searchParams.get("error");
    const returnTo = normalizeReturnPath(searchParams.get("returnTo"));

    if (error) {
      redirectToLogin(error);
      return;
    }

    getMe()
      .unwrap()
      .then(async (apiUser) => {
        dispatch(setUser(apiUserToUser(apiUser)));
        const permissions = await getPermissions().unwrap();
        dispatch(setPermissions(permissions));
        replaceAppPath(returnTo);
      })
      .catch(() => {
        setMessage("Sign-in failed. Redirecting…");
        redirectToLogin("session_failed");
      });
  }, [dispatch, getMe, getPermissions, searchParams]);

  return (
    <div className="space-y-2 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Signing you in</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
