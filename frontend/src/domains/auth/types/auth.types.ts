export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  roleCode?: string;
  role?: {
    code: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}
