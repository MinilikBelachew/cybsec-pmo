"use client";

import { useEffect } from "react";
import { installLoginHistoryTrap } from "../utils/login-history-trap";

/**
 * After logout, history still contains Microsoft Entra pages from SSO.
 * Trap Back on the login page so those entries cannot auto-start Entra.
 */
export function LoginHistoryGuard() {
  useEffect(() => {
    installLoginHistoryTrap();
  }, []);

  return null;
}
