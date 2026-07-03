import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import { toCaslAction, resolveCaslSubject, type CaslAction } from "./casl.constants";
import type { PermissionRow } from "../types/permissions.types";

export type AppAbility = MongoAbility<[CaslAction, string]>;

export function defineAbilityFor(permissions: PermissionRow[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const applied = new Set<string>();

  for (const permission of permissions) {
    const action = toCaslAction(permission.action);
    const subject = resolveCaslSubject(permission.module, permission.action);
    const key = `${action}:${subject}`;
    if (applied.has(key)) {
      continue;
    }
    applied.add(key);
    can(action, subject);
  }

  return build();
}

export function canAccess(
  ability: AppAbility | null | undefined,
  action: CaslAction,
  subject: string,
): boolean {
  if (!ability) return false;
  return ability.can(action, subject);
}
