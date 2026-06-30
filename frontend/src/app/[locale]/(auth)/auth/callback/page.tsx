import { Suspense } from "react";
import { AuthCallbackPage } from "@/domains/auth";

export const metadata = {
  title: "Signing in — PMO",
};

export default function AuthCallbackRoute() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Signing in…</div>}>
      <AuthCallbackPage />
    </Suspense>
  );
}
