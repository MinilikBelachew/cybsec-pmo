import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { RedisService } from '../redis/redis.service';
import { SessionService } from '../session/session.service';
import { AuditLogsService } from '../audit/audit-logs.service';
import { SessionSecurityConfig } from './config/session-security.config';

const ACTIVITY_KEY_PREFIX = 'session:activity:';

@Injectable()
export class SessionActivityService {
  constructor(
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
    private readonly auditLogsService: AuditLogsService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private get config(): SessionSecurityConfig {
    return this.configService.getOrThrow('sessionSecurity', { infer: true });
  }

  private activityKey(sessionId: string): string {
    return `${ACTIVITY_KEY_PREFIX}${sessionId}`;
  }

  async touch(sessionId: string): Promise<void> {
    const now = Date.now().toString();
    await this.redis.set(
      this.activityKey(sessionId),
      now,
      this.config.idleTimeoutSec,
    );
  }

  async assertActive(
    sessionId: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      userId?: string;
      isExternal?: boolean;
    },
  ): Promise<void> {
    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.expiresAt <= new Date()) {
      await this.revokeForTimeout(sessionId, context);
      throw new UnauthorizedException();
    }

    const lastActivityRaw = await this.redis.get(this.activityKey(sessionId));
    const lastActivity = lastActivityRaw
      ? parseInt(lastActivityRaw, 10)
      : session.createdAt.getTime();

    const idleMs = this.config.idleTimeoutSec * 1000;
    if (Date.now() - lastActivity > idleMs) {
      await this.revokeForTimeout(sessionId, context);
      throw new UnauthorizedException();
    }

    await this.touch(sessionId);
  }

  async revokeForTimeout(
    sessionId: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      userId?: string;
      isExternal?: boolean;
    },
  ): Promise<void> {
    await this.sessionService.deleteById(sessionId);
    await this.redis.del(this.activityKey(sessionId));

    try {
      await this.auditLogsService.create({
        action: 'SESSION_TIMEOUT',
        objectType: 'Session',
        objectId: sessionId,
        newValue: {
          reason: 'idle_timeout',
          idleTimeoutSec: this.config.idleTimeoutSec,
          userId: context?.userId,
          userAgent: context?.userAgent,
        },
        ipAddress: context?.ipAddress,
        isExternal: context?.isExternal === true,
        source: 'WebAPI',
        ...(context?.userId
          ? { user: { connect: { id: context.userId } } }
          : {}),
      });
    } catch {
      // Audit failure must not block auth response
    }
  }

  getPolicy() {
    const { idleTimeoutSec, warningBeforeSec } = this.config;
    return {
      idleTimeoutMs: idleTimeoutSec * 1000,
      warningAtMs: Math.max(idleTimeoutSec - warningBeforeSec, 0) * 1000,
      warningBeforeMs: warningBeforeSec * 1000,
    };
  }
}
