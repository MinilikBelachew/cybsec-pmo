"use client";

import { Button } from "@/shared/ui/button";
import { env } from "@/config/env.config";
import { useSearchParams } from "next/navigation";

function getErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "access_denied") {
    return "Sign-in was cancelled. Please try again.";
  }
  if (code === "session_failed" || code === "auth_failed") {
    return "Authentication failed. Please try again.";
  }
  if (code === "session_timeout") {
    return "Your session ended due to inactivity. Please sign in again.";
  }
  return "Could not complete sign-in. Please try again.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const error = getErrorMessage(searchParams.get("error"));

  const handleMicrosoftLogin = () => {
    const returnTo = searchParams.get("callbackUrl") || "/dashboard";
    const url = new URL(`${env.apiUrl}/auth/entra/authorize`);
    url.searchParams.set("returnTo", returnTo);
    window.location.href = url.toString();
  };

  return (
    <div className="space-y-6">
      <Button
        id="login-submit"
        type="button"
        className="w-full flex items-center justify-center gap-3 py-6 text-base font-semibold transition-all duration-300 bg-white hover:bg-white/95 text-gray-950 border border-transparent rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-[0.98] cursor-pointer"
        onClick={handleMicrosoftLogin}
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
        Sign in with Microsoft
      </Button>

      {error && (
        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          {error}
        </div>
      )}
    </div>
  );
}
