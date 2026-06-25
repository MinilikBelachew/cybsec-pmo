"use client";

import { Button } from "@/shared/ui/button";

type SessionTimeoutModalProps = {
  open: boolean;
  secondsLeft: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
};

export function SessionTimeoutModal({
  open,
  secondsLeft,
  onStaySignedIn,
  onSignOut,
}: SessionTimeoutModalProps) {
  if (!open) return null;

  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <h2 id="session-timeout-title" className="text-lg font-semibold">
          Session expiring soon
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have been inactive. Your session will end in about {minutes}{" "}
          minute{minutes === 1 ? "" : "s"} for security.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
          <Button type="button" onClick={onStaySignedIn}>
            Stay signed in
          </Button>
        </div>
      </div>
    </div>
  );
}
