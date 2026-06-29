"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useLazyGetMeQuery, useLazyGetMyPermissionsQuery } from "../api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { apiUserToUser } from "../transformers/auth.transformer";
import { setPermissions, setUser } from "../store/auth.slice";
import { normalizeReturnPath } from "@/shared/utils/return-path";

export function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [getMe] = useLazyGetMeQuery();
  const [getPermissions] = useLazyGetMyPermissionsQuery();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const error = searchParams.get("error");
    const returnTo = normalizeReturnPath(searchParams.get("returnTo"));

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    getMe()
      .unwrap()
      .then(async (apiUser) => {
        dispatch(setUser(apiUserToUser(apiUser)));
        const permissions = await getPermissions().unwrap();
        dispatch(setPermissions(permissions));
        router.replace(returnTo);
      })
      .catch(() => {
        setMessage("Sign-in failed. Redirecting…");
        router.replace("/login?error=session_failed");
      });
  }, [dispatch, getMe, getPermissions, router, searchParams]);

  return (
    <div className="space-y-2 text-center">
      <h1 className="text-2xl font-semibold text-white">Signing you in</h1>
      <p className="text-sm text-white/60">{message}</p>
    </div>
  );
}
