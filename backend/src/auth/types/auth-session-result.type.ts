import { User } from '../../users/domain/user';

export type AuthSessionResult = {
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: User;
};
