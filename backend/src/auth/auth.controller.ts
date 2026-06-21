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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthEntraLoginDto } from './dto/auth-entra-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { NullableType } from '../utils/types/nullable.type';
import { User } from '../users/domain/user';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { Response as ExpressResponse } from 'express';

// Cookie config shared across login and refresh
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function setAuthCookies(
  res: ExpressResponse,
  token: string,
  refreshToken: string,
  tokenExpires: number,
) {
  const isProd = process.env.NODE_ENV === 'production';

  // access_token — short-lived (15 min), httpOnly so JS cannot touch it
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,             // HTTPS only in production
    expires: new Date(tokenExpires),
    path: '/',
  });

  // refresh_token — long-lived (10 years), httpOnly
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years in ms
    path: '/api/v1/auth/refresh',  // only sent to the refresh endpoint
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
  @ApiOkResponse({ type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: AuthEntraLoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    const result = await this.service.validateEntraLogin(loginDto.idToken);

    // Set both tokens as httpOnly cookies — JS cannot read these
    setAuthCookies(res, result.token, result.refreshToken, result.tokenExpires);

    return result;
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
  @ApiOkResponse({ type: RefreshResponseDto })
  @SerializeOptions({ groups: ['me'] })
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Request() request,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<RefreshResponseDto> {
    const result = await this.service.refreshToken({
      sessionId: request.user.sessionId,
      refreshTokenHash: request.user.refreshTokenHash,
    });

    // Rotate both cookies on every refresh
    setAuthCookies(res, result.token, result.refreshToken, result.tokenExpires);

    return result;
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

    // Clear both cookies immediately on logout
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth/refresh' });
  }
}
