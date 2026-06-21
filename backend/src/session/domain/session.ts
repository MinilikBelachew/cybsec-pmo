import { User } from '../../users/domain/user';

export class Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  user?: User;
}

