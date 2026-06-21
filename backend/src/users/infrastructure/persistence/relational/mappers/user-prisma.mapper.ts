import {
  User as PrismaUser,
  Role as PrismaRole,
} from '@prisma/client';
import { User } from '../../../../domain/user';
import { Role } from '../../../../../roles/domain/role';

type UserWithRelations = PrismaUser & {
  role?: PrismaRole | null;
};

export class UserPrismaMapper {
  static toDomain(raw: UserWithRelations): User {
    const domainEntity = new User();
    domainEntity.id = raw.id;
    domainEntity.entraObjectId = raw.entraObjectId;
    domainEntity.email = raw.email;
    domainEntity.displayName = raw.displayName;
    domainEntity.roleCode = raw.roleCode;
    domainEntity.isActive = raw.isActive;
    domainEntity.isExternal = raw.isExternal;
    domainEntity.lastLogin = raw.lastLogin;

    if (raw.role) {
      const role = new Role();
      role.code = raw.role.code;
      role.label = raw.role.label;
      role.isExternal = raw.role.isExternal;
      domainEntity.role = role;
    }

    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: User) {
    return {
      id: domainEntity.id || undefined,
      entraObjectId: domainEntity.entraObjectId,
      email: domainEntity.email,
      displayName: domainEntity.displayName,
      roleCode: domainEntity.roleCode,
      isActive: domainEntity.isActive,
      isExternal: domainEntity.isExternal,
      lastLogin: domainEntity.lastLogin,
      createdAt: domainEntity.createdAt,
      updatedAt: domainEntity.updatedAt,
    };
  }
}

