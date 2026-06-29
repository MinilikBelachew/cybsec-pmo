import { routing } from "@/i18n/routing";

/**
 * Paths for post-login navigation must be locale-free — next-intl router adds the locale.
 * e.g. "/en/dashboard" → "/dashboard"
 */
export function normalizeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  let normalized = path;
  for (const locale of routing.locales) {
    if (normalized === `/${locale}`) {
      return "/dashboard";
    }
    if (normalized.startsWith(`/${locale}/`)) {
      normalized = normalized.slice(locale.length + 1);
      break;
    }
  }

  if (normalized === "" || normalized === "/") {
    return "/dashboard";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
