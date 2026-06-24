import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import ms from 'ms';
import crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import { NullableType } from '../utils/types/nullable.type';
import { AuthSessionResult } from './types/auth-session-result.type';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './strategies/types/jwt-refresh-payload.type';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { Session } from '../session/domain/session';
import { SessionService } from '../session/session.service';
import { User } from '../users/domain/user';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { AuthFailureService } from './auth-failure.service';
import { AuthLoginContext } from './types/auth-login-context.type';
import { extractEmailHintFromIdToken } from './utils/id-token.util';
import { LoginSecurityException } from './exceptions/login-security.exception';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private configService: ConfigService<AllConfigType>,
    private authFailureService: AuthFailureService,
  ) {}

  async validateEntraLogin(
    idToken: string,
    context: AuthLoginContext,
  ): Promise<AuthSessionResult> {
    const emailHint = extractEmailHintFromIdToken(idToken);

    await this.authFailureService.assertLoginAllowed(context, emailHint);

    try {
      const tenantId = this.configService.getOrThrow('auth.entraTenantId', {
        infer: true,
      });
      const clientId = this.configService.getOrThrow('auth.entraClientId', {
        infer: true,
      });

      const decoded = await this.verifyEntraIdToken(
        idToken,
        tenantId,
        clientId,
      );

      const email = decoded.email || decoded.preferred_username || decoded.upn;
      if (!email) {
        await this.authFailureService.recordLoginFailure(
          context,
          'MISSING_EMAIL',
          emailHint,
        );
        throw new UnauthorizedException('Authentication failed');
      }

      let user = await this.usersService.findByEmail(email.toLowerCase());
      if (!user) {
        user = await this.usersService.create({
          entraObjectId: decoded.oid,
          email: email.toLowerCase(),
          displayName: decoded.name || email.split('@')[0],
          role: {
            code: 'engineer',
          },
          isActive: true,
          isExternal: false,
        });
      }

      if (!user.isActive) {
        await this.authFailureService.recordLoginFailure(
          context,
          'INACTIVE_USER',
          email.toLowerCase(),
        );
        throw new UnauthorizedException('Authentication failed');
      }

      const entraObjectId = decoded.oid;
      await this.usersService.updateInternal(user.id, {
        entraObjectId,
        lastLogin: new Date(),
      });

      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');

      const session = await this.sessionService.create({
        userId: user.id,
        refreshTokenHash,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: new Date(
          Date.now() +
            ms(this.configService.getOrThrow('auth.refreshExpires', { infer: true })),
        ),
      });

      const { token, refreshToken, tokenExpires } = await this.getTokensData({
        id: user.id,
        role: {
          code: user.role?.code || user.roleCode,
        },
        sessionId: session.id,
        refreshTokenHash,
      });

      await this.authFailureService.recordLoginSuccess(
        context,
        email.toLowerCase(),
      );

      return {
        refreshToken,
        token,
        tokenExpires,
        user,
      };
    } catch (error) {
      if (error instanceof LoginSecurityException) {
        throw error;
      }

      if (error instanceof UnauthorizedException) {
        await this.authFailureService.recordLoginFailure(
          context,
          'INVALID_TOKEN',
          emailHint,
        );
        throw new UnauthorizedException('Authentication failed');
      }

      throw error;
    }
  }

  private verifyEntraIdToken(
    idToken: string,
    tenantId: string,
    clientId: string,
  ): Promise<jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      const client = jwksClient({
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      });

      jwt.verify(
        idToken,
        (header, callback) => {
          client.getSigningKey(header.kid, (err, key) => {
            if (err || !key) {
              callback(err || new Error('JWKS signing key not found'));
            } else {
              callback(null, key.getPublicKey());
            }
          });
        },
        {
          audience: clientId,
          issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          algorithms: ['RS256'],
        },
        (err, result) => {
          if (err) {
            reject(new UnauthorizedException('Authentication failed'));
          } else {
            resolve(result as jwt.JwtPayload);
          }
        },
      );
    });
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sessionId' | 'refreshTokenHash'>,
  ): Promise<Omit<AuthSessionResult, 'user'>> {
    const session = await this.sessionService.findById(data.sessionId);

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.refreshTokenHash !== data.refreshTokenHash) {
      throw new UnauthorizedException();
    }

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const user = await this.usersService.findById(session.userId);

    if (!user?.role) {
      throw new UnauthorizedException();
    }

    await this.sessionService.update(session.id, {
      refreshTokenHash,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.userId,
      role: {
        code: user.role.code,
      },
      sessionId: session.id,
      refreshTokenHash,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async logout(data: Pick<JwtRefreshPayloadType, 'sessionId'>) {
    return this.sessionService.deleteById(data.sessionId);
  }

  private async getTokensData(data: {
    id: User['id'];
    role: { code: string };
    sessionId: Session['id'];
    refreshTokenHash: Session['refreshTokenHash'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: data.role,
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          refreshTokenHash: data.refreshTokenHash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }
}
