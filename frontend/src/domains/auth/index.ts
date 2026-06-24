/**
 * Strict public API for the auth domain.
 * Only what is listed here is accessible outside this folder.
 * auth.api.ts and auth.service.ts are intentionally NOT exported.
 */

// Hooks (public interface to React UI)
export { useLogin } from "./hooks/use-login";
export { useAuth } from "./hooks/use-auth";

// Components
export { AuthLayoutShell } from "./components/auth-layout-shell";
export { LoginPage } from "./components/login-page";
export { LoginForm } from "./components/login-form";
export { RegisterForm } from "./components/register-form";

// Types (for use in other domains if needed)
export type { User, EntraLoginRequestDto, LoginResponseDto } from "./types/auth.types";

// Store actions (for middleware / root store)
export { setUser, clearUser, logout } from "./store/auth.slice";
