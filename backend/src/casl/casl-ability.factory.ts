import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { toCaslAction, toCaslSubject } from './casl.constants';
import {
  AppAbility,
  CaslUserContext,
  PermissionRow,
} from './casl.types';
import { PermissionsCacheService } from './permissions-cache.service';

@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly permissionsCache: PermissionsCacheService) {}

  createForUser(user: CaslUserContext): AppAbility {
    const permissions = this.permissionsCache.getByRoleId(user.roleId);
    return this.buildFromPermissions(permissions);
  }

  /**
   * Module-level rules only (no Prisma conditions).
   * Row-level filters are built by RecordScopeWhereService — not via @casl/prisma.
   */
  buildFromPermissions(permissions: PermissionRow[]): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const applied = new Set<string>();

    for (const permission of permissions) {
      const action = toCaslAction(permission.action);
      const subject = toCaslSubject(permission.module);

      if (subject === 'all') {
        continue;
      }

      const key = `${action}:${subject}`;
      if (applied.has(key)) {
        continue;
      }
      applied.add(key);

      can(action, subject);

      // RBAC matrix uses tasks.edit (not tasks.create) for task authoring.
      if (permission.action === 'edit' && subject === 'Task') {
        const createKey = `create:${subject}`;
        if (!applied.has(createKey)) {
          applied.add(createKey);
          can('create', subject);
        }
      }
    }

    return build();
  }
}
