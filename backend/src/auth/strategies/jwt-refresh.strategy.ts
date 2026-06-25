import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './types/jwt-refresh-payload.type';
import { OrNeverType } from '../../utils/types/or-never.type';
import { AllConfigType } from '../../config/config.type';
import { SessionActivityService } from '../session-activity.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionActivityService: SessionActivityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.cookies?.refresh_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: configService.getOrThrow('auth.refreshSecret', {
        infer: true,
      }),
    });
  }

  public async validate(
    payload: JwtRefreshPayloadType,
  ): Promise<OrNeverType<JwtRefreshPayloadType>> {
    if (!payload.sessionId) {
      throw new UnauthorizedException();
    }

    await this.sessionActivityService.assertActive(payload.sessionId);

    return payload;
  }
}
