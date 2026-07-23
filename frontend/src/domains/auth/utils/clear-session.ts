import type { AppDispatch } from "@/store";
import { api } from "@/core/api/api";
import { clearUser, logout } from "@/domains/auth/store/auth.slice";

export type LoginRedirectError =
  | "session_expired"
  | "session_timeout"
  | "session_failed"
  | undefined;

/** Locale-aware hard navigation to login (replaces history entry). */
export function redirectToLogin(error?: LoginRedirectError) {
  if (typeof window === "undefined") return;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const locale = segments[0] || "en";
  const qs = error ? `?error=${encodeURIComponent(error)}` : "";
  window.location.replace(`/${locale}/login${qs}`);
}

/** Clear Redux auth + RTK Query cache so restored pages cannot show stale signed-in UI. */
export function clearClientSession(dispatch: AppDispatch) {
  dispatch(logout());
  dispatch(clearUser());
  dispatch(api.util.resetApiState());
}

/**
 * Full client sign-out cleanup then hard redirect to login.
 * Prefer this over soft router.push so Back cannot restore authenticated SPA state.
 */
export function endClientSession(
  dispatch: AppDispatch,
  error?: LoginRedirectError,
) {
  clearClientSession(dispatch);
  redirectToLogin(error);
}
