export interface EntraLoginRequestDto {
  idToken: string;
}

export interface LoginResponseDto {
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: ApiUser;
}

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
