import { subject } from '@casl/ability';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { CaslAbilityFactory } from './casl-ability.factory';
import { resolveCaslUser } from './casl-user.util';
import {
  CHECK_ABILITY_KEY,
  CheckAbilityMeta,
} from './decorators/check-ability.decorator';
import { AppAbility, CaslUserContext } from './casl.types';

export type RequestWithAbility = {
  user?: {
    id: string;
    role?: { id?: number; code?: string };
    roleId?: number;
    roleCode?: string;
  };
  ability?: AppAbility;
  caslUser?: CaslUserContext;
};

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CheckAbilityMeta | undefined>(
      CHECK_ABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAbility>();

    if (!request.ability || !request.caslUser) {
      const caslUser = await resolveCaslUser(this.prisma, request);
      request.caslUser = caslUser;
      request.ability = this.abilityFactory.createForUser(caslUser);
    }

    const allowed = request.ability!.can(
      meta.action,
      subject(meta.subject, { __caslSubjectType__: meta.subject }),
    );

    if (!allowed) {
      throw new ForbiddenException();
    }

    return true;
  }
}
