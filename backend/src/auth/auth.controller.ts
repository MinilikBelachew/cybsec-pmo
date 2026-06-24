import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  Response,
  Post,
  UseGuards,
  SerializeOptions,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthEntraLoginDto } from './dto/auth-entra-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { NullableType } from '../utils/types/nullable.type';
import { User } from '../users/domain/user';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
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
  constructor(private readonly service: AuthService) {}

  @SerializeOptions({ groups: ['me'] })
  @Post('entra/login')
  @UseFilters(LoginSecurityExceptionFilter)
  @ApiOkResponse({ type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: AuthEntraLoginDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    const result = await this.service.validateEntraLogin(loginDto.idToken, {
      ipAddress: extractClientIp(req),
      userAgent: extractUserAgent(req),
    });

    setAuthCookies(res, result.token, result.refreshToken, result.tokenExpires);

    return { user: result.user };
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
