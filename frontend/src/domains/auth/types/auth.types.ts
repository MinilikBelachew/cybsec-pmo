export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  roleId?: number;
  roleCode?: string;
  role?: {
    code: string;
  };
  breakGlass?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  roleId?: number;
  breakGlass?: boolean;
  /** Real role code from API (pm, it_admin, engineer, …). */
  backendRoleCode?: string;
}

export type SessionPolicy = {
  idleTimeoutMs: number;
  warningAtMs: number;
  warningBeforeMs: number;
};
