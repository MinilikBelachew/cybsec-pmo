/**
 * Strict public API for the auth domain.
 * Only what is listed here is accessible outside this folder.
 * auth.api.ts and auth.service.ts are intentionally NOT exported.
 */

// Hooks (public interface to React UI)
export { useLogin } from "./hooks/use-login";
export { useAuth } from "./hooks/use-auth";

// Components
export { LoginForm } from "./components/login-form";
export { RegisterForm } from "./components/register-form";

// Types (for use in other domains if needed)
export type { User, LoginRequestDto, LoginResponseDto } from "./types/auth.types";

// Store actions (for middleware / root store)
export { setUser, clearUser, logout } from "./store/auth.slice";
