import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import { CaslAbilityFactory } from './casl-ability.factory';
import { RequestWithAbility } from './casl.guard';
import { resolveCaslUser } from './casl-user.util';

/** Attaches CASL ability to every authenticated request (for record-level queries). */
@Injectable()
export class CaslAbilityInterceptor implements NestInterceptor {
  constructor(
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithAbility>();

    if (request.user?.id && !request.ability) {
      try {
        const caslUser = await resolveCaslUser(this.prisma, request);
        request.caslUser = caslUser;
        request.ability = this.abilityFactory.createForUser(caslUser);
      } catch {
        // Unauthenticated or incomplete user — leave ability unset
      }
    }

    return next.handle();
  }
}
