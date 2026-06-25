import { Session as PrismaSession, User as PrismaUser } from '@prisma/client';
import { Session } from '../../../../domain/session';
import { UserPrismaMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user-prisma.mapper';

type SessionWithRelations = PrismaSession & {
  user?:
    | (PrismaUser & {
        role?: any;
      })
    | null;
};

export class SessionPrismaMapper {
  static toDomain(raw: SessionWithRelations): Session {
    const domainEntity = new Session();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    domainEntity.refreshTokenHash = raw.refreshTokenHash;
    domainEntity.ipAddress = raw.ipAddress;
    domainEntity.userAgent = raw.userAgent;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.revokedAt = raw.revokedAt;
    domainEntity.isBreakGlass = raw.isBreakGlass;
    domainEntity.breakGlassReason = raw.breakGlassReason;
    domainEntity.createdAt = raw.createdAt;
    if (raw.user) {
      domainEntity.user = UserPrismaMapper.toDomain(raw.user);
    }
    return domainEntity;
  }

  static toPersistence(domainEntity: Session) {
    return {
      id: domainEntity.id || undefined,
      userId: domainEntity.userId,
      refreshTokenHash: domainEntity.refreshTokenHash,
      ipAddress: domainEntity.ipAddress,
      userAgent: domainEntity.userAgent,
      expiresAt: domainEntity.expiresAt,
      revokedAt: domainEntity.revokedAt,
      isBreakGlass: domainEntity.isBreakGlass ?? false,
      breakGlassReason: domainEntity.breakGlassReason,
      createdAt: domainEntity.createdAt,
    };
  }
}

