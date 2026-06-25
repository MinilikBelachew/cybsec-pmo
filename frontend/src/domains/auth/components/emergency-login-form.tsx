"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useEmergencyLoginMutation } from "../api/auth.api";
import { useAppDispatch } from "@/store/hooks";
import { apiUserToUser } from "../transformers/auth.transformer";
import { setUser } from "../store/auth.slice";
import { cn } from "@/shared/utils/cn";

export function EmergencyLoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [emergencyLogin, { isLoading }] = useEmergencyLoginMutation();

  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const result = await emergencyLogin({ email, secret, reason }).unwrap();
      dispatch(setUser(apiUserToUser({ ...result.user, breakGlass: true })));
      router.replace("/dashboard");
    } catch {
      setError("Emergency authentication failed. Check your credentials and try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="emergency-email" className="text-sm font-medium text-white/80">
          Admin email
        </label>
        <Input
          id="emergency-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="emergency-secret" className="text-sm font-medium text-white/80">
          Vault emergency secret
        </label>
        <Input
          id="emergency-secret"
          type="password"
          autoComplete="off"
          required
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="emergency-reason" className="text-sm font-medium text-white/80">
          Incident reason (required for audit)
        </label>
        <textarea
          id="emergency-reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Microsoft Entra ID outage — incident INC-2026-014"
          className={cn(
            "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white",
            "placeholder:text-white/40 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        />
      </div>

      {error && (
        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg text-center">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full py-6 text-base font-semibold"
      >
        {isLoading ? "Authenticating…" : "Emergency sign-in"}
      </Button>
    </form>
  );
}
