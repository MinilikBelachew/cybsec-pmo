import type { AppDispatch } from "@/store";
import { api } from "@/core/api/api";
import { clearUser, logout } from "@/domains/auth/store/auth.slice";

export type LoginRedirectError = string | undefined;

export const SESSION_ENDED_KEY = "pmo.session-ended";

export function markSessionEnded() {
  try {
    sessionStorage.setItem(SESSION_ENDED_KEY, "1");
  } catch {
    // Private mode / disabled storage — history trap still applies.
  }
}

export function clearSessionEndedMark() {
  try {
    sessionStorage.removeItem(SESSION_ENDED_KEY);
  } catch {
    // ignore
  }
}

export function isSessionEnded(): boolean {
  try {
    return sessionStorage.getItem(SESSION_ENDED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Locale-aware hard navigation to login (replaces history entry). */
export function redirectToLogin(error?: LoginRedirectError) {
  if (typeof window === "undefined") return;
  markSessionEnded();
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
