import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import ms from 'ms';
import { AllConfigType } from '../config/config.type';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthLoginContext } from './types/auth-login-context.type';
import { RoleEnum } from '../roles/roles.enum';
import { AuditLogsService } from '../audit/audit-logs.service';
import { resolveUserIsExternal } from './utils/user-external.util';
import { formatIpWithUserAgent } from './utils/request-context.util';
import { SecurityAlertService } from './security-alert.service';
import { AuthFailureService } from './auth-failure.service';
import { AuthSessionResult } from './types/auth-session-result.type';
import { SessionService } from '../session/session.service';

const BREAK_GLASS_ROLES = new Set<string>([
  RoleEnum.super_admin,
  RoleEnum.it_admin,
]);

@Injectable()
export class BreakGlassService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly auditLogsService: AuditLogsService,
    private readonly securityAlertService: SecurityAlertService,
    private readonly authFailureService: AuthFailureService,
    private readonly sessionService: SessionService,
  ) {}

  async activateForSuperAdmin(
    userId: string,
    reason: string,
    context: AuthLoginContext,
    currentSessionId?: string,
  ): Promise<AuthSessionResult> {
    const user = await this.usersService.findById(userId);
    const roleCode = user?.role?.code;

    if (!user?.isActive || roleCode !== RoleEnum.super_admin) {
      throw new ForbiddenException(
        'Only active Super Admins can activate break-glass',
      );
    }

    if (currentSessionId) {
      await this.authService.logout({ sessionId: currentSessionId });
    }

    return this.createBreakGlassSession(
      user,
      reason,
      context,
      'SUPER_ADMIN_ACTIVATE',
    );
  }

  async emergencyLogin(
    email: string,
    secret: string,
    reason: string,
    context: AuthLoginContext,
  ): Promise<AuthSessionResult> {
    const config = this.configService.getOrThrow('breakGlass', { infer: true });

    if (!config.enabled) {
      throw new ForbiddenException('Emergency login is disabled');
    }

    await this.authFailureService.assertLoginAllowed(context, email);

    if (!this.isValidSecret(secret, config.emergencySecret)) {
      await this.authFailureService.recordLoginFailure(
        context,
        'INVALID_TOKEN',
        email,
      );
      throw new UnauthorizedException('Authentication failed');
    }

    const user = await this.usersService.findByEmail(email.toLowerCase());
    const roleCode = user?.role?.code;

    if (!user?.isActive || !roleCode || !BREAK_GLASS_ROLES.has(roleCode)) {
      await this.authFailureService.recordLoginFailure(
        context,
        'INACTIVE_USER',
        email,
      );
      throw new UnauthorizedException('Authentication failed');
    }

    await this.authFailureService.recordLoginSuccess(
      context,
      email.toLowerCase(),
    );

    return this.createBreakGlassSession(user, reason, context, 'EMERGENCY_LOGIN');
  }

  async stopBreakGlassSession(
    userId: string,
    sessionId: string,
    context: AuthLoginContext,
  ): Promise<{ redirectTo: 'entra' | 'login' }> {
    const session = await this.sessionService.findById(sessionId);

    if (!session?.isBreakGlass) {
      throw new ForbiddenException('Not an active break-glass session');
    }

    const user = await this.usersService.findById(userId);
    const roleCode = user?.role?.code;

    await this.authService.logout({ sessionId });

    await this.auditLogsService.create({
      action: 'BREAK_GLASS_STOPPED',
      objectType: 'Session',
      objectId: sessionId,
      breakGlassAction: true,
      newValue: {
        breakGlassAction: true,
        userId,
        email: user?.email,
        roleCode,
        stoppedAt: new Date().toISOString(),
        originalReason: session.breakGlassReason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      ipAddress: formatIpWithUserAgent(context.ipAddress, context.userAgent),
      isExternal: resolveUserIsExternal(user ?? {}),
      source: 'WebAPI',
      user: { connect: { id: userId } },
    });

    return {
      redirectTo: roleCode === RoleEnum.super_admin ? 'entra' : 'login',
    };
  }

  private async createBreakGlassSession(
    user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>,
    reason: string,
    context: AuthLoginContext,
    activationType: 'SUPER_ADMIN_ACTIVATE' | 'EMERGENCY_LOGIN',
  ): Promise<AuthSessionResult> {
    const ttl = this.configService.getOrThrow('breakGlass.ttl', { infer: true });
    const sessionExpiresAt = new Date(Date.now() + ms(ttl));

    const result = await this.authService.createAuthenticatedSession(
      user,
      context,
      {
        isBreakGlass: true,
        breakGlassReason: reason,
        sessionExpiresAt,
        accessTokenExpiresIn: ttl,
      },
    );

    await this.auditLogsService.create({
      action: 'BREAK_GLASS_ACTIVATED',
      objectType: 'Session',
      objectId: result.sessionId,
      breakGlassAction: true,
      newValue: {
        breakGlassAction: true,
        activationType,
        reason,
        userId: user.id,
        email: user.email,
        roleCode: user.role?.code,
        expiresAt: sessionExpiresAt.toISOString(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      ipAddress: formatIpWithUserAgent(context.ipAddress, context.userAgent),
      isExternal: resolveUserIsExternal(user),
      source: 'WebAPI',
      user: { connect: { id: user.id } },
    });

    void this.securityAlertService.emit(
      {
        code: 'BREAK_GLASS_ACTIVATED',
        severity: 'critical',
        message: `Break-glass access activated (${activationType})`,
        context: {
          activationType,
          reason,
          userId: user.id,
          email: user.email,
          roleCode: user.role?.code,
          ipAddress: context.ipAddress,
        },
      },
      `break-glass:${user.id}`,
      ms(ttl) / 1000,
    );

    return result;
  }

  private isValidSecret(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }
}
