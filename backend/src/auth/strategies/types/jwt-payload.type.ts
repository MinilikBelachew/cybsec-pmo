import { Session } from '../../../session/domain/session';
import { User } from '../../../users/domain/user';

export type JwtPayloadType = Pick<User, 'id' | 'role'> & {
  roleId?: number;
  sessionId: Session['id'];
  breakGlass?: boolean;
  isExternal?: boolean;
  iat: number;
  exp: number;
};
