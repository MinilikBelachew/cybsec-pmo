"use client";

import { useEffect } from "react";

/**
 * After logout, history still contains protected URLs. Trap Back on the login
 * page so those entries cannot be restored as an interactive signed-in shell.
 */
export function LoginHistoryGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.history.pushState(null, "", window.location.href);

    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
