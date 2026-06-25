import { Suspense } from "react";
import { EmergencyLoginForm } from "./emergency-login-form";
import { Link } from "@/i18n/routing";

export function EmergencyLoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Emergency access
        </h1>
        <p className="text-sm text-white/50 font-light">
          Use only when Microsoft Entra ID is unavailable. All actions are audited and alerted.
        </p>
      </div>

      <Suspense fallback={<div className="text-center text-sm text-white/50">Loading…</div>}>
        <EmergencyLoginForm />
      </Suspense>

      <p className="text-center text-xs text-white/40">
        <Link href="/login" className="underline hover:text-white/70">
          Return to standard sign-in
        </Link>
      </p>
    </div>
  );
}
