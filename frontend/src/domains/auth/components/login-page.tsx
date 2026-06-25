import { Suspense } from "react";
import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome Back</h1>
        <p className="text-sm text-white/50 font-light">
          Please authenticate with your enterprise Microsoft account.
        </p>
      </div>

      <div className="space-y-4">
        <Suspense fallback={<div className="text-center text-sm text-white/50">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="text-center text-xs text-white/40 leading-relaxed">
        This platform uses Single Sign-On (SSO) for authentication. <br />
        If Entra ID is unavailable,{" "}
        <a href="/emergency-login" className="underline hover:text-white/70">
          use emergency access
        </a>
        . Otherwise contact your systems administrator.
      </p>
    </div>
  );
}
