export { useAuth } from "./hooks/use-auth";

export { AuthLayoutShell } from "./components/auth-layout-shell";
export { LoginPage } from "./components/login-page";
export { LoginForm } from "./components/login-form";
export { AuthCallbackPage } from "./components/auth-callback-page";
export { EmergencyLoginPage } from "./components/emergency-login-page";
export { RegisterForm } from "./components/register-form";

export type { User, ApiUser } from "./types/auth.types";

export { setUser, setPermissions, clearUser, logout } from "./store/auth.slice";
export { useAppAbility, AbilityProvider } from "./casl/ability-context";
export { useModulePermissions } from "./hooks/use-module-permissions";
export { hasModulePermission } from "./utils/module-permissions";
export type { PermissionRow } from "./types/permissions.types";
