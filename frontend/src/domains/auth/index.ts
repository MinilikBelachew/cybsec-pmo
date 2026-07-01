/**
 * Strict public API for the auth domain.
 * Only what is listed here is accessible outside this folder.
 * auth.api.ts and auth.service.ts are intentionally NOT exported.
 */

// Hooks (public interface to React UI)
export { useAuth } from "./hooks/use-auth";

// Components
export { AuthLayoutShell } from "./components/auth-layout-shell";
export { LoginPage } from "./components/login-page";
export { LoginForm } from "./components/login-form";
export { AuthCallbackPage } from "./components/auth-callback-page";
export { EmergencyLoginPage } from "./components/emergency-login-page";
export { RegisterForm } from "./components/register-form";

// Types (for use in other domains if needed)
export type { User, ApiUser } from "./types/auth.types";

// Store actions (for middleware / root store)
export { setUser, setPermissions, clearUser, logout } from "./store/auth.slice";
export { useAppAbility, AbilityProvider } from "./casl/ability-context";
export { useModulePermissions } from "./hooks/use-module-permissions";
export { hasModulePermission } from "./utils/module-permissions";
export type { PermissionRow } from "./types/permissions.types";
