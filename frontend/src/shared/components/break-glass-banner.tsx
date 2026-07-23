"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/domains/auth";
import { useStopBreakGlassMutation } from "@/domains/auth/api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { env } from "@/config/env.config";
import { Button } from "@/shared/ui/button";
import { endClientSession, clearClientSession } from "@/domains/auth/utils/clear-session";

export function BreakGlassBanner() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [stopBreakGlass, { isLoading }] = useStopBreakGlassMutation();
  const [error, setError] = useState<string | null>(null);

  if (!user?.breakGlass) {
    return null;
  }

  const handleStopSession = async () => {
    setError(null);

    try {
      const { redirectTo } = await stopBreakGlass().unwrap();

      if (redirectTo === "entra") {
        clearClientSession(dispatch);
        const url = new URL(`${env.apiUrl}/auth/entra/authorize`);
        url.searchParams.set("returnTo", "/dashboard");
        window.location.href = url.toString();
        return;
      }

      endClientSession(dispatch);
    } catch {
      setError("Could not end break-glass session. You have been signed out.");
      endClientSession(dispatch);
    }
  };

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 sm:items-center">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Break-glass session active — all actions are audited. User changes are
            disabled until this session ends.
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={handleStopSession}
          className="shrink-0 border-amber-600/50 bg-amber-50/80 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
        >
          {isLoading ? "Ending session…" : "Stop break-glass session"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
