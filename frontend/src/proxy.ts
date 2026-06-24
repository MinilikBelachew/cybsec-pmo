import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { PUBLIC_PATH_PREFIXES } from "./config/routes.config";

const intlMiddleware = createMiddleware(routing);

function isPublicPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, "") || "/";
  if (pathWithoutLocale === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathWithoutLocale.startsWith(p));
}

// ---------------------------------------------------------------------------
// Next.js 16 Proxy (replaces middleware.ts)
// Exported function MUST be named `proxy`.
// ---------------------------------------------------------------------------
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and internal next paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/") // API routes don't use next-intl
  ) {
    return NextResponse.next();
  }

  // 1. Check for auth cookie
  const accessToken = request.cookies.get("access_token")?.value;

  // 2. If not authenticated and NOT on a public path, redirect to login
  if (!accessToken && !isPublicPath(pathname)) {
    // Let next-intl handle the redirection to the correct localized /login page
    request.nextUrl.pathname = "/login";
    request.nextUrl.searchParams.set("callbackUrl", pathname);
    return intlMiddleware(request);
  }

  // 3. For all other page requests, let next-intl handle locales
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
