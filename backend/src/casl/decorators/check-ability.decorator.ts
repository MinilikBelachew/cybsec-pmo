import { SetMetadata } from '@nestjs/common';
import { CaslAction } from '../casl.types';

export const CHECK_ABILITY_KEY = 'check_ability';

export type CheckAbilityMeta = {
  action: CaslAction;
  subject: string;
  /** Additional (action, subject) pairs — pass if any check succeeds. */
  anyOf?: Array<{ action: CaslAction; subject: string }>;
};

export const CheckAbility = (
  action: CaslAction,
  subject: string,
  anyOf?: Array<{ action: CaslAction; subject: string }>,
) =>
  SetMetadata(CHECK_ABILITY_KEY, {
    action,
    subject,
    ...(anyOf?.length ? { anyOf } : {}),
  } satisfies CheckAbilityMeta);
