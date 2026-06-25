import { User } from '../../users/domain/user';

export type AuthSessionResult = {
  sessionId: string;
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: User;
  breakGlass?: boolean;
  breakGlassReason?: string | null;
};
