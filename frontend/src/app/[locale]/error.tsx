"use client";

import { useEffect } from "react";
import { APP_NAME } from "@/shared/constants";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">{error.message}</p>
      <button onClick={reset} className="mt-2 text-sm underline underline-offset-4">
        Try again
      </button>
    </div>
  );
}
