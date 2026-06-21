import { Session } from '../../../session/domain/session';

export type JwtRefreshPayloadType = {
  sessionId: Session['id'];
  refreshTokenHash: Session['refreshTokenHash'];
  iat: number;
  exp: number;
};

