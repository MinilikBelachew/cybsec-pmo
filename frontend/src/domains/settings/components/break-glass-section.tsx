"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  useActivateBreakGlassMutation,
  useLazyGetMeQuery,
} from "@/domains/auth/api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { apiUserToUser } from "@/domains/auth/transformers/auth.transformer";
import { setUser } from "@/domains/auth/store/auth.slice";
import { useAuth } from "@/domains/auth";

type BreakGlassSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function BreakGlassSection({ onSuccess, onError }: BreakGlassSectionProps) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [activateBreakGlass, { isLoading }] = useActivateBreakGlassMutation();
  const [getMe] = useLazyGetMeQuery();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (user?.breakGlass) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Break-glass mode is active for this session. User account changes are blocked.
      </div>
    );
  }

  const handleActivate = async () => {
    if (!confirmed || reason.trim().length < 10) {
      onError("Provide an incident reason (at least 10 characters) and confirm activation.");
      return;
    }

    try {
      await activateBreakGlass({ reason: reason.trim() }).unwrap();
      const apiUser = await getMe().unwrap();
      dispatch(setUser(apiUserToUser(apiUser)));
      setReason("");
      setConfirmed(false);
      onSuccess("Break-glass mode activated. Security team has been alerted.");
    } catch {
      onError("Could not activate break-glass mode. Ensure you are signed in as Super Admin.");
    }
  };

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Break-glass access</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Activate emergency administrative access when Entra SSO is unavailable. This creates a
            short-lived session (4 hours), sends a critical security alert, and tags all actions in
            the audit log.
          </p>
        </div>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Incident reason — e.g. Entra outage, incident ticket number"
        className={cn(
          "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      />

      <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>
          I confirm this is a genuine emergency and understand all actions will be audited and
          reported to the security team.
        </span>
      </label>

      <Button
        type="button"
        variant="destructive"
        disabled={isLoading || !confirmed || reason.trim().length < 10}
        onClick={handleActivate}
      >
        {isLoading ? "Activating…" : "Activate break-glass"}
      </Button>
    </section>
  );
}
