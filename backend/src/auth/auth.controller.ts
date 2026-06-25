import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  Response,
  Post,
  UseGuards,
  SerializeOptions,
  UseFilters,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { EntraOauthService } from './entra-oauth.service';
import { SessionActivityService } from './session-activity.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NullableType } from '../utils/types/nullable.type';
import { User } from '../users/domain/user';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import {
  extractClientIp,
  extractUserAgent,
} from './utils/request-context.util';
import { LoginSecurityExceptionFilter } from './filters/login-security-exception.filter';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function setAuthCookies(
  res: ExpressResponse,
  token: string,
  refreshToken: string,
  tokenExpires: number,
) {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    expires: new Date(tokenExpires),
    path: '/',
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  });
}

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly entraOauthService: EntraOauthService,
    private readonly sessionActivityService: SessionActivityService,
  ) {}

  @Get('session-policy')
  @HttpCode(HttpStatus.OK)
  public sessionPolicy() {
    return this.sessionActivityService.getPolicy();
  }

  @ApiBearerAuth()
  @Post('session/heartbeat')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async sessionHeartbeat(@Request() request): Promise<void> {
    await this.sessionActivityService.touch(request.user.sessionId);
  }

  @Get('entra/authorize')
  @HttpCode(HttpStatus.FOUND)
  public async entraAuthorize(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { authorizationUrl } =
      await this.entraOauthService.createAuthorizationRequest(returnTo);
    res.redirect(authorizationUrl);
  }

  @Get('entra/callback')
  @UseFilters(LoginSecurityExceptionFilter)
  public async entraCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Request() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const fallbackReturnTo = '/dashboard';

    if (error || !code || !state) {
      res.redirect(
        this.entraOauthService.getFrontendCallbackUrl(
          fallbackReturnTo,
          error ?? 'auth_failed',
        ),
      );
      return;
    }

    try {
      const { idToken, nonce, returnTo } =
        await this.entraOauthService.exchangeCodeForIdToken(code, state);

      const result = await this.service.validateEntraLogin(
        idToken,
        {
          ipAddress: extractClientIp(req),
          userAgent: extractUserAgent(req),
        },
        { expectedNonce: nonce },
      );

      setAuthCookies(
        res,
        result.token,
        result.refreshToken,
        result.tokenExpires,
      );

      res.redirect(
        this.entraOauthService.getFrontendCallbackUrl(returnTo),
      );
    } catch {
      res.redirect(
        this.entraOauthService.getFrontendCallbackUrl(
          fallbackReturnTo,
          'auth_failed',
        ),
      );
    }
  }

  @ApiBearerAuth()
  @SerializeOptions({ groups: ['me'] })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({ type: User })
  @HttpCode(HttpStatus.OK)
  public me(@Request() request): Promise<NullableType<User>> {
    return this.service.me(request.user);
  }

  @ApiBearerAuth()
  @SerializeOptions({ groups: ['me'] })
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async refresh(
    @Request() request,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<void> {
    const result = await this.service.refreshToken({
      sessionId: request.user.sessionId,
      refreshTokenHash: request.user.refreshTokenHash,
    });

    setAuthCookies(res, result.token, result.refreshToken, result.tokenExpires);
  }

  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @Request() request,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<void> {
    await this.service.logout({ sessionId: request.user.sessionId });

    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth/refresh' });
  }
}
