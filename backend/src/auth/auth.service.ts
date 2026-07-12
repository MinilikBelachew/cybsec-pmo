import {
  Injectable,
  Logger,
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
import { SessionActivityService } from './session-activity.service';
import { ROLE_ID_BY_CODE } from '../roles/role-catalog';
import { RoleEnum } from '../roles/roles.enum';
import { PermissionsCacheService } from '../casl/permissions-cache.service';
import { PermissionRow } from '../casl/casl.types';
import { AuditLogsService } from '../audit/audit-logs.service';
import { resolveUserIsExternal } from './utils/user-external.util';
import { formatIpWithUserAgent } from './utils/request-context.util';
import { EmployeeUserLinkService } from '../keka/employee-user-link.service';

type CreateSessionOptions = {
  isBreakGlass?: boolean;
  breakGlassReason?: string;
  sessionExpiresAt?: Date;
  accessTokenExpiresIn?: ms.StringValue;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private configService: ConfigService<AllConfigType>,
    private authFailureService: AuthFailureService,
    private sessionActivityService: SessionActivityService,
    private permissionsCache: PermissionsCacheService,
    private auditLogsService: AuditLogsService,
    private employeeUserLinkService: EmployeeUserLinkService,
  ) {}

  async validateEntraLogin(
    idToken: string,
    context: AuthLoginContext,
    options?: { expectedNonce?: string },
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
        options?.expectedNonce,
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
            id: ROLE_ID_BY_CODE.engineer,
            code: RoleEnum.engineer,
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

      await this.employeeUserLinkService.linkUserToEmployeeByEmail(
        user.id,
        email.toLowerCase(),
      );

      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');

      const session = await this.sessionService.create({
        userId: user.id,
        refreshTokenHash,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        isBreakGlass: false,
        breakGlassReason: null,
        expiresAt: new Date(
          Date.now() +
            ms(this.configService.getOrThrow('auth.refreshExpires', { infer: true })),
        ),
      });

      const { token, refreshToken, tokenExpires } = await this.getTokensData({
        id: user.id,
        role: {
          id: user.roleId,
          code: user.role?.code ?? RoleEnum.engineer,
        },
        sessionId: session.id,
        refreshTokenHash,
        isBreakGlass: false,
        isExternal: resolveUserIsExternal(user),
      });

      await this.authFailureService.recordLoginSuccess(
        context,
        email.toLowerCase(),
      );

      await this.writeLoginAudit(user, session.id, context);

      await this.sessionActivityService.touch(session.id);

      return {
        sessionId: session.id,
        refreshToken,
        token,
        tokenExpires,
        user,
        breakGlass: false,
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
    expectedNonce?: string,
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
            const payload = result as jwt.JwtPayload;
            if (expectedNonce && payload.nonce !== expectedNonce) {
              reject(new UnauthorizedException('Authentication failed'));
              return;
            }
            resolve(payload);
          }
        },
      );
    });
  }

  async me(
    userJwtPayload: JwtPayloadType,
  ): Promise<(User & { breakGlass?: boolean }) | null> {
    const user = await this.usersService.findById(userJwtPayload.id);
    if (!user) return null;
    return {
      ...user,
      breakGlass: userJwtPayload.breakGlass === true,
    } as User & { breakGlass?: boolean };
  }

  async getPermissionsForUser(
    userJwtPayload: JwtPayloadType,
  ): Promise<PermissionRow[]> {
    const roleId =
      userJwtPayload.roleId ??
      userJwtPayload.role?.id;
    if (!roleId) {
      return [];
    }
    // Read from DB so Roles & Permissions matrix grants show up immediately
    // (in-memory cache can lag until refresh / restart).
    return this.permissionsCache.getByRoleIdFromDb(roleId);
  }

  async createAuthenticatedSession(
    user: User,
    context: AuthLoginContext,
    options: CreateSessionOptions = {},
  ): Promise<AuthSessionResult> {
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const isBreakGlass = options.isBreakGlass === true;
    const sessionExpiresAt =
      options.sessionExpiresAt ??
      new Date(
        Date.now() +
          ms(this.configService.getOrThrow('auth.refreshExpires', { infer: true })),
      );

    const session = await this.sessionService.create({
      userId: user.id,
      refreshTokenHash,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      isBreakGlass,
      breakGlassReason: options.breakGlassReason ?? null,
      expiresAt: sessionExpiresAt,
    });

    const accessTokenExpiresIn =
      options.accessTokenExpiresIn ??
      (isBreakGlass
        ? this.configService.getOrThrow('breakGlass.ttl', { infer: true })
        : this.configService.getOrThrow('auth.expires', { infer: true }));

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: {
        id: user.roleId,
        code: user.role?.code ?? RoleEnum.engineer,
      },
      sessionId: session.id,
      refreshTokenHash,
      isBreakGlass,
      accessTokenExpiresIn,
      isExternal: resolveUserIsExternal(user),
    });

    await this.sessionActivityService.touch(session.id);

    return {
      sessionId: session.id,
      token,
      refreshToken,
      tokenExpires,
      user,
      breakGlass: isBreakGlass,
      breakGlassReason: options.breakGlassReason ?? null,
    };
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
        id: user.roleId,
        code: user.role.code,
      },
      sessionId: session.id,
      refreshTokenHash,
      isBreakGlass: session.isBreakGlass,
      accessTokenExpiresIn: session.isBreakGlass
        ? this.configService.getOrThrow('breakGlass.ttl', { infer: true })
        : undefined,
      isExternal: resolveUserIsExternal(user),
    });

    await this.sessionActivityService.touch(session.id);

    return {
      sessionId: session.id,
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async logout(data: Pick<JwtRefreshPayloadType, 'sessionId'>) {
    return this.sessionService.deleteById(data.sessionId);
  }

  private async writeLoginAudit(
    user: User,
    sessionId: string,
    context: AuthLoginContext,
  ): Promise<void> {
    const isExternal = resolveUserIsExternal(user);

    try {
      await this.auditLogsService.create({
        action: 'LOGIN',
        objectType: 'Auth',
        objectId: sessionId,
        newValue: {
          method: 'entra',
          email: user.email,
          roleCode: user.role?.code ?? user.roleCode,
          userAgent: context.userAgent ?? undefined,
        },
        ipAddress: formatIpWithUserAgent(context.ipAddress, context.userAgent),
        isExternal,
        source: 'WebAPI',
        user: { connect: { id: user.id } },
      });
    } catch (err) {
      this.logger.error('Failed to persist LOGIN audit row', err);
    }
  }

  private async getTokensData(data: {
    id: User['id'];
    role: { id: number; code: string };
    sessionId: Session['id'];
    refreshTokenHash: Session['refreshTokenHash'];
    isBreakGlass?: boolean;
    accessTokenExpiresIn?: ms.StringValue;
    isExternal?: boolean;
  }) {
    const tokenExpiresIn =
      data.accessTokenExpiresIn ??
      this.configService.getOrThrow('auth.expires', { infer: true });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const refreshExpiresIn = data.isBreakGlass
      ? this.configService.getOrThrow('breakGlass.ttl', { infer: true })
      : this.configService.getOrThrow('auth.refreshExpires', { infer: true });

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          roleId: data.role.id,
          role: data.role,
          sessionId: data.sessionId,
          ...(data.isExternal ? { isExternal: true } : {}),
          ...(data.isBreakGlass ? { breakGlass: true } : {}),
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
          expiresIn: refreshExpiresIn,
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
