import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { AuditLogsService } from '../audit/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { SecurityAlertsConfig } from './config/security-alerts.config';

import { SecurityAlertMailData } from '../mail/types/security-alert-mail.type';

export type SecurityAlertPayload = SecurityAlertMailData;

@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly auditLogsService: AuditLogsService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
  ) {}

  private get config(): SecurityAlertsConfig {
    return this.configService.getOrThrow('securityAlerts', { infer: true });
  }

  async emit(
    payload: SecurityAlertPayload,
    dedupeKey?: string,
    dedupeTtlSec = 1800,
  ): Promise<void> {
    this.logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'SECURITY_ALERT',
        ...payload,
      }),
    );

    try {
      await this.auditLogsService.create({
        action: 'SECURITY_ALERT',
        objectType: 'Auth',
        objectId: null,
        newValue: {
          code: payload.code,
          message: payload.message,
          severity: payload.severity,
          ...payload.context,
        },
        isExternal: false,
        source: 'WebAPI',
      });
    } catch (err) {
      this.logger.error('Failed to persist SECURITY_ALERT audit row', err);
    }

    if (!this.config.enabled) return;

    if (dedupeKey) {
      const sent = await this.redis.get(`security:alert:sent:${dedupeKey}`);
      if (sent) return;
      await this.redis.set(
        `security:alert:sent:${dedupeKey}`,
        '1',
        dedupeTtlSec,
      );
    }

    try {
      await this.mailService.sendSecurityAlert({
        to: this.config.alertEmail,
        data: payload,
      });
    } catch (err) {
      this.logger.error('Failed to send security alert email', err);
    }
  }
}
