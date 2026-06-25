import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { OrNeverType } from '../../utils/types/or-never.type';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';
import { SessionActivityService } from '../session-activity.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionActivityService: SessionActivityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
    });
  }

  public async validate(
    payload: JwtPayloadType,
  ): Promise<OrNeverType<JwtPayloadType>> {
    if (!payload.id || !payload.sessionId) {
      throw new UnauthorizedException();
    }

    await this.sessionActivityService.assertActive(payload.sessionId, {
      userId: payload.id,
    });

    return payload;
  }
}
