"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useLazyGetMeQuery } from "../api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { apiUserToUser } from "../transformers/auth.transformer";
import { setUser } from "../store/auth.slice";

export function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [getMe] = useLazyGetMeQuery();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const error = searchParams.get("error");
    const returnTo = searchParams.get("returnTo") || "/dashboard";

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    getMe()
      .unwrap()
      .then((apiUser) => {
        dispatch(setUser(apiUserToUser(apiUser)));
        router.replace(returnTo);
      })
      .catch(() => {
        setMessage("Sign-in failed. Redirecting…");
        router.replace("/login?error=session_failed");
      });
  }, [dispatch, getMe, router, searchParams]);

  return (
    <div className="space-y-2 text-center">
      <h1 className="text-2xl font-semibold text-white">Signing you in</h1>
      <p className="text-sm text-white/60">{message}</p>
    </div>
  );
}
