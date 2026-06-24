import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit/audit-logs.service';
import { RedisService } from '../redis/redis.service';
import { AllConfigType } from '../config/config.type';
import { LoginSecurityConfig } from '../auth/config/login-security.config';
import { LoginSecurityException } from '../auth/exceptions/login-security.exception';
import {
  AuthLoginContext,
  AuthLoginFailureReason,
} from '../auth/types/auth-login-context.type';

@Injectable()
export class AuthFailureService {
  private readonly logger = new Logger(AuthFailureService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private get config(): LoginSecurityConfig {
    return this.configService.getOrThrow('loginSecurity', { infer: true });
  }

  /**
   * Per PDF §12.2: login endpoints limited to 10 req/min per IP.
   * Also checks account lockout before processing the token.
   */
  async assertLoginAllowed(
    context: AuthLoginContext,
    emailHint?: string | null,
  ): Promise<void> {
    const ip = this.normalizeIp(context.ipAddress);
    const email = emailHint ? this.normalizeEmail(emailHint) : null;

    await this.assertRateLimit(ip);
    await this.assertNotLocked(ip, email);
  }

  async recordLoginSuccess(
    context: AuthLoginContext,
    email: string,
  ): Promise<void> {
    const ip = this.normalizeIp(context.ipAddress);
    const normalizedEmail = this.normalizeEmail(email);

    await this.redis.del(
      this.failIpKey(ip),
      this.failEmailKey(normalizedEmail),
      this.lockIpKey(ip),
      this.lockEmailKey(normalizedEmail),
    );
  }

  async recordLoginFailure(
    context: AuthLoginContext,
    reason: AuthLoginFailureReason,
    emailHint?: string | null,
  ): Promise<void> {
    const cfg = this.config;
    const ip = this.normalizeIp(context.ipAddress);
    const email = emailHint ? this.normalizeEmail(emailHint) : null;

    const ipFailures = await this.redis.incr(
      this.failIpKey(ip),
      cfg.failureWindowSec,
    );

    let emailFailures = 0;
    if (email) {
      emailFailures = await this.redis.incr(
        this.failEmailKey(email),
        cfg.failureWindowSec,
      );
    }

    const peakFailures = Math.max(ipFailures, emailFailures);

    await this.writeFailureAudit(context, reason, email, peakFailures);

    if (peakFailures >= cfg.maxFailures) {
      await this.redis.set(this.lockIpKey(ip), '1', cfg.lockoutSec);
      if (email) {
        await this.redis.set(this.lockEmailKey(email), '1', cfg.lockoutSec);
      }
    }

    if (peakFailures >= cfg.alertThreshold) {
      this.emitSecurityAlert(context, email, peakFailures, reason);
    }
  }

  private async assertRateLimit(ip: string): Promise<void> {
    const cfg = this.config;
    const count = await this.redis.incr(
      this.rateIpKey(ip),
      cfg.rateLimitWindowSec,
    );

    if (count > cfg.rateLimitPerIp) {
      throw new LoginSecurityException(
        'Too many login requests. Please wait before trying again.',
        'AUTH_RATE_LIMITED',
        cfg.rateLimitWindowSec,
      );
    }
  }

  private async assertNotLocked(
    ip: string,
    email: string | null,
  ): Promise<void> {
    const cfg = this.config;

    const ipLocked = await this.redis.get(this.lockIpKey(ip));
    const emailLocked = email
      ? await this.redis.get(this.lockEmailKey(email))
      : null;

    if (ipLocked || emailLocked) {
      throw new LoginSecurityException(
        'Too many failed login attempts. Your access is temporarily locked.',
        'AUTH_LOGIN_LOCKED',
        cfg.lockoutSec,
      );
    }
  }

  private async writeFailureAudit(
    context: AuthLoginContext,
    reason: AuthLoginFailureReason,
    email: string | null,
    attemptCount: number,
  ): Promise<void> {
    try {
      await this.auditLogsService.create({
        action: 'LOGIN_FAILED',
        objectType: 'Auth',
        objectId: null,
        newValue: {
          reason,
          email: email ?? undefined,
          attemptCount,
          userAgent: context.userAgent,
        },
        ipAddress: context.ipAddress,
        isExternal: false,
        source: 'WebAPI',
      });
    } catch (err) {
      this.logger.error('Failed to persist LOGIN_FAILED audit row', err);
    }

    this.logger.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'SECURITY',
        event: 'LOGIN_FAILED',
        reason,
        email,
        attemptCount,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
    );
  }

  private emitSecurityAlert(
    context: AuthLoginContext,
    email: string | null,
    attemptCount: number,
    reason: AuthLoginFailureReason,
  ): void {
    // PDF §19.3: 5+ failed logins/user → security team alert + audit
    this.logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'SECURITY_ALERT',
        event: 'AUTH_ANOMALY',
        code: 'AUTH_FAILED_LOGIN_THRESHOLD',
        message: `${attemptCount} failed login attempts detected`,
        email,
        ipAddress: context.ipAddress,
        reason,
        userAgent: context.userAgent,
        action: 'NOTIFY_SECURITY_TEAM',
      }),
    );
  }

  private normalizeIp(ip: string): string {
    return ip.replace(/^::ffff:/, '').trim() || 'unknown';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private rateIpKey(ip: string): string {
    return `auth:rl:ip:${ip}`;
  }

  private failIpKey(ip: string): string {
    return `auth:fail:ip:${ip}`;
  }

  private failEmailKey(email: string): string {
    return `auth:fail:email:${email}`;
  }

  private lockIpKey(ip: string): string {
    return `auth:lock:ip:${ip}`;
  }

  private lockEmailKey(email: string): string {
    return `auth:lock:email:${email}`;
  }
}
