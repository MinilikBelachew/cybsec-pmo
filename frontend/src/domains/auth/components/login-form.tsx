"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useRouter } from "@/i18n/routing";
import { useLogin } from "../hooks/use-login";
import { Button } from "@/shared/ui/button";

export function LoginForm() {
  const router = useRouter();
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { loginWithToken, isLoading: isBackendLoading, error: backendError } = useLogin();
  const [msalError, setMsalError] = useState<string | null>(null);
  const [handledRedirect, setHandledRedirect] = useState(false);

  // Log MSAL state for debugging
  useEffect(() => {
    console.log("[MSAL Debug] inProgress:", inProgress);
    console.log("[MSAL Debug] accounts:", accounts);
    console.log("[MSAL Debug] isAuthenticated:", isAuthenticated);
  }, [inProgress, accounts, isAuthenticated]);

  // After MsalProvider internally handles the redirect, the accounts array gets populated.
  // We detect that here and exchange the token with our backend.
  useEffect(() => {
    if (handledRedirect) return;
    if (inProgress !== InteractionStatus.None) return;
    if (accounts.length === 0) return;

    const account = accounts[0];
    console.log("[MSAL Debug] Got account after redirect:", account);

    // Acquire the ID token silently for the account that just logged in
    instance
      .acquireTokenSilent({
        account,
        scopes: ["openid", "profile", "email"],
      })
      .then(async (response) => {
        console.log("[MSAL Debug] acquireTokenSilent success, idToken:", response.idToken?.slice(0, 30) + "...");
        setHandledRedirect(true);
        await loginWithToken(response.idToken);
        router.push("/dashboard");
      })
      .catch((err) => {
        console.error("[MSAL Debug] acquireTokenSilent error:", err);
        setMsalError(err.message || "Failed to retrieve token.");
      });
  }, [inProgress, accounts, instance, loginWithToken, router, handledRedirect]);

  const handleMicrosoftLogin = async () => {
    setMsalError(null);
    console.log("[MSAL Debug] Initiating loginRedirect...");
    try {
      await instance.loginRedirect({
        scopes: ["openid", "profile", "email"],
        prompt: "select_account",
        redirectUri: `${window.location.origin}/login`,
      });
    } catch (err: any) {
      console.error("[MSAL Debug] loginRedirect error:", err);
      setMsalError(err.message || "Could not redirect to Microsoft Sign-in.");
    }
  };

  const isLoading =
    inProgress !== InteractionStatus.None || isBackendLoading;
  const error = msalError || backendError;

  return (
    <div className="space-y-6">
      <Button
        id="login-submit"
        type="button"
        className="w-full flex items-center justify-center gap-3 py-6 text-base font-semibold transition-all duration-300 bg-white hover:bg-white/95 text-gray-950 border border-transparent rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-[0.98] cursor-pointer"
        onClick={handleMicrosoftLogin}
        disabled={isLoading}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 23 23"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 0H11V11H0V0Z" fill="#F25022" />
          <path d="M12 0H23V11H12V0Z" fill="#7FBA00" />
          <path d="M0 12H11V23H0V12Z" fill="#00A1F1" />
          <path d="M12 12H23V23H12V12Z" fill="#FFB900" />
        </svg>
        {isLoading ? "Signing in…" : "Sign in with Microsoft"}
      </Button>

      {error && (
        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          {error}
        </div>
      )}
    </div>
  );
}
