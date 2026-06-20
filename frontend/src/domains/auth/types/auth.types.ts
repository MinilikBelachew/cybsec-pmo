export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: ApiUser;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}
