export const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];

/** Path prefixes that skip auth in the edge proxy (locale prefix stripped). */
export const PUBLIC_PATH_PREFIXES = [
  ...PUBLIC_ROUTES,
  "/api/auth",
  "/api/health",
];

export const DEFAULT_AUTH_REDIRECT = "/dashboard";
export const DEFAULT_PUBLIC_REDIRECT = "/login";

export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  profile: "/profile",
  settings: "/settings",
};
