import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { AllConfigType } from '../config/config.type';
import { PrismaService } from '../database/prisma.service';
import { MailConfig } from '../mail/config/mail-config.type';
import {
  decryptSecret,
  encryptSecret,
  maskSecretValue,
} from '../common/utils/integration-secrets.util';
import { SendgridClient } from './sendgrid.client';
import {
  MailConnectionResponseDto,
  MailConnectionTestResultDto,
  TestMailConnectionDto,
  UpdateMailConnectionDto,
} from './dto/mail-connection.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class MailConnectionService {
  private readonly logger = new Logger(MailConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sendgridClient: SendgridClient,
  ) {}

  async getEffectiveConfig(): Promise<MailConfig> {
    const row = await this.prisma.mailConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    const envPort = this.configService.get('mail.port', { infer: true }) ?? 587;
    const envHost = this.configService.get('mail.host', { infer: true });
    const envUser = this.configService.get('mail.user', { infer: true });
    const envPassword = this.configService.get('mail.password', {
      infer: true,
    });
    const envDefaultEmail = this.configService.get('mail.defaultEmail', {
      infer: true,
    });
    const envDefaultName = this.configService.get('mail.defaultName', {
      infer: true,
    });
    const envIgnoreTls =
      this.configService.get('mail.ignoreTLS', { infer: true }) ?? false;
    const envSecure =
      this.configService.get('mail.secure', { infer: true }) ?? false;
    const envRequireTls =
      this.configService.get('mail.requireTLS', { infer: true }) ?? false;
    const envSendgridApiKey = this.configService.get('mail.sendgridApiKey', {
      infer: true,
    });
    const envSendgridEnabled =
      this.configService.get('mail.sendgridEnabled', { infer: true }) ?? true;

    const dbSendgridKey = this.safeDecrypt(row?.sendgridApiKeyEncrypted ?? null);
    const dbSmtpPassword = this.safeDecrypt(row?.smtpPasswordEncrypted ?? null);

    const hasDbConfig = Boolean(
      row &&
        (row.smtpHost ||
          row.smtpUser ||
          row.smtpPasswordEncrypted ||
          row.sendgridApiKeyEncrypted ||
          row.defaultEmail ||
          row.defaultName),
    );

    return {
      port: row?.smtpPort ?? envPort,
      host: row?.smtpHost?.trim() || envHost || undefined,
      user: row?.smtpUser?.trim() || envUser || undefined,
      password: dbSmtpPassword || envPassword || undefined,
      defaultEmail: row?.defaultEmail?.trim() || envDefaultEmail || undefined,
      defaultName: row?.defaultName?.trim() || envDefaultName || undefined,
      ignoreTLS: hasDbConfig ? Boolean(row?.smtpIgnoreTls) : envIgnoreTls,
      secure: hasDbConfig ? Boolean(row?.smtpSecure) : envSecure,
      requireTLS: hasDbConfig ? Boolean(row?.smtpRequireTls) : envRequireTls,
      sendgridApiKey: dbSendgridKey || envSendgridApiKey || undefined,
      sendgridEnabled: hasDbConfig
        ? Boolean(row?.sendgridEnabled)
        : envSendgridEnabled,
    };
  }

  async isConfigured(): Promise<boolean> {
    const cfg = await this.getEffectiveConfig();
    const hasSendgrid = Boolean(cfg.sendgridEnabled && cfg.sendgridApiKey);
    const hasSmtp = Boolean(cfg.host);
    return Boolean((hasSendgrid || hasSmtp) && cfg.defaultEmail);
  }

  async getConnectionView(): Promise<MailConnectionResponseDto> {
    const row = await this.prisma.mailConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const effective = await this.getEffectiveConfig();

    const envHost = this.configService.get('mail.host', { infer: true });
    const envSendgridKey = this.configService.get('mail.sendgridApiKey', {
      infer: true,
    });

    const hasDbCreds = Boolean(
      row &&
        (row.smtpHost ||
          row.sendgridApiKeyEncrypted ||
          row.smtpPasswordEncrypted ||
          row.defaultEmail),
    );
    const hasEnvCreds = Boolean(envHost || envSendgridKey);

    let source: 'database' | 'env' | 'mixed' | 'none' = 'none';
    if (hasDbCreds) {
      source = hasEnvCreds ? 'mixed' : 'database';
      if (row?.smtpHost || row?.sendgridApiKeyEncrypted) {
        source = 'database';
      }
    } else if (hasEnvCreds) {
      source = 'env';
    }

    const configured = Boolean(
      ((effective.sendgridEnabled && effective.sendgridApiKey) ||
        effective.host) &&
        effective.defaultEmail,
    );

    return {
      sendgridEnabled: effective.sendgridEnabled,
      sendgridApiKeyMasked: maskSecretValue(effective.sendgridApiKey ?? null),
      hasSendgridApiKey: Boolean(effective.sendgridApiKey),
      smtpHost: effective.host ?? null,
      smtpPort: effective.port,
      smtpUser: effective.user ?? null,
      hasSmtpPassword: Boolean(effective.password),
      smtpSecure: effective.secure,
      smtpIgnoreTls: effective.ignoreTLS,
      smtpRequireTls: effective.requireTLS,
      defaultEmail: effective.defaultEmail ?? null,
      defaultName: effective.defaultName ?? null,
      source,
      configured,
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestStatus: (row?.lastTestStatus as 'ok' | 'failed' | null) ?? null,
      lastTestError: row?.lastTestError ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async updateConnection(
    dto: UpdateMailConnectionDto,
    actorId: string | null,
  ): Promise<MailConnectionResponseDto> {
    const existing = await this.prisma.mailConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    const existingSendgridKey = this.safeDecrypt(
      existing?.sendgridApiKeyEncrypted ?? null,
    );
    const existingSmtpPass = this.safeDecrypt(
      existing?.smtpPasswordEncrypted ?? null,
    );

    const nextSendgridKey = this.resolveSecretUpdate(
      dto.sendgridApiKey,
      existingSendgridKey,
    );
    const nextSmtpPass = this.resolveSecretUpdate(
      dto.smtpPassword,
      existingSmtpPass,
    );

    const sendgridEnabled =
      dto.sendgridEnabled !== undefined
        ? dto.sendgridEnabled
        : (existing?.sendgridEnabled ?? false);

    const smtpHost =
      dto.smtpHost !== undefined
        ? dto.smtpHost.trim() || null
        : (existing?.smtpHost ?? null);

    const smtpPort =
      dto.smtpPort !== undefined
        ? dto.smtpPort
        : (existing?.smtpPort ?? 587);

    const smtpUser =
      dto.smtpUser !== undefined
        ? dto.smtpUser.trim() || null
        : (existing?.smtpUser ?? null);

    const smtpSecure =
      dto.smtpSecure !== undefined
        ? dto.smtpSecure
        : (existing?.smtpSecure ?? false);

    const smtpIgnoreTls =
      dto.smtpIgnoreTls !== undefined
        ? dto.smtpIgnoreTls
        : (existing?.smtpIgnoreTls ?? false);

    const smtpRequireTls =
      dto.smtpRequireTls !== undefined
        ? dto.smtpRequireTls
        : (existing?.smtpRequireTls ?? false);

    const defaultEmail =
      dto.defaultEmail !== undefined
        ? dto.defaultEmail.trim() || null
        : (existing?.defaultEmail ?? null);

    const defaultName =
      dto.defaultName !== undefined
        ? dto.defaultName.trim() || null
        : (existing?.defaultName ?? null);

    await this.prisma.mailConnectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        sendgridEnabled,
        sendgridApiKeyEncrypted: nextSendgridKey
          ? encryptSecret(nextSendgridKey)
          : null,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPasswordEncrypted: nextSmtpPass ? encryptSecret(nextSmtpPass) : null,
        smtpSecure,
        smtpIgnoreTls,
        smtpRequireTls,
        defaultEmail,
        defaultName,
        updatedById: actorId,
      },
      update: {
        sendgridEnabled,
        sendgridApiKeyEncrypted: nextSendgridKey
          ? encryptSecret(nextSendgridKey)
          : null,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPasswordEncrypted: nextSmtpPass ? encryptSecret(nextSmtpPass) : null,
        smtpSecure,
        smtpIgnoreTls,
        smtpRequireTls,
        defaultEmail,
        defaultName,
        updatedById: actorId,
      },
    });

    return this.getConnectionView();
  }

  async testConnection(
    actorId: string | null,
    dto: TestMailConnectionDto,
  ): Promise<MailConnectionTestResultDto> {
    const saved = await this.getEffectiveConfig();
    const effective: MailConfig = {
      sendgridEnabled:
        dto.sendgridEnabled !== undefined
          ? dto.sendgridEnabled
          : saved.sendgridEnabled,
      sendgridApiKey: dto.sendgridApiKey?.trim() || saved.sendgridApiKey,
      host: dto.smtpHost?.trim() || saved.host,
      port: dto.smtpPort ?? saved.port,
      user: dto.smtpUser !== undefined ? dto.smtpUser.trim() || saved.user : saved.user,
      password: dto.smtpPassword?.trim() || saved.password,
      secure: dto.smtpSecure !== undefined ? dto.smtpSecure : saved.secure,
      ignoreTLS:
        dto.smtpIgnoreTls !== undefined ? dto.smtpIgnoreTls : saved.ignoreTLS,
      requireTLS:
        dto.smtpRequireTls !== undefined ? dto.smtpRequireTls : saved.requireTLS,
      defaultEmail: dto.defaultEmail?.trim() || saved.defaultEmail,
      defaultName: dto.defaultName?.trim() || saved.defaultName || 'CyberSec PMO',
    };

    if (!effective.defaultEmail) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Default sender email address is required to send a test email.',
        errors: { connection: 'missingDefaultEmail' },
      });
    }

    const from = `"${effective.defaultName || 'CyberSec PMO'}" <${effective.defaultEmail}>`;
    const subject = 'CyberSec PMO — Email Configuration Test';
    const text =
      'This is a test email from CyberSec PMO verifying your email configuration is working.';
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="margin:0 0 12px;color:#0f172a;">CyberSec PMO Email Test</h2>
      <p style="margin:0;color:#334155;line-height:1.6;">
        Your email delivery settings are configured and working correctly.
      </p>
    </div>`;

    const now = new Date();
    let sendgridError: string | null = null;

    if (effective.sendgridEnabled && effective.sendgridApiKey) {
      try {
        await this.sendgridClient.send(
          {
            to: dto.testEmail,
            from,
            subject,
            text,
            html,
          },
          effective.sendgridApiKey,
        );
        await this.recordTestStatus(now, 'ok', null, actorId);
        return {
          success: true,
          provider: 'sendgrid',
          message: `Test email sent to ${dto.testEmail} via SendGrid.`,
          testedAt: now,
        };
      } catch (error) {
        sendgridError =
          error instanceof Error ? error.message : 'SendGrid send failed.';
        if (!effective.host) {
          await this.recordTestStatus(now, 'failed', sendgridError, actorId);
          throw new BadRequestException({
            status: HttpStatus.BAD_REQUEST,
            message: sendgridError,
            errors: { connection: 'testFailed' },
          });
        }
      }
    }

    if (!effective.host) {
      const msg =
        sendgridError ||
        'Configure either SendGrid (enabled + API key) or an SMTP host before testing.';
      await this.recordTestStatus(now, 'failed', msg, actorId);
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: msg,
        errors: { connection: 'testFailed' },
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: effective.host,
        port: effective.port,
        ignoreTLS: effective.ignoreTLS,
        secure: effective.secure,
        requireTLS: effective.requireTLS,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 15_000,
        ...(effective.user
          ? {
              auth: {
                user: effective.user,
                pass: effective.password,
              },
            }
          : {}),
      });

      await transporter.sendMail({
        to: dto.testEmail,
        from,
        subject,
        text,
        html,
      });

      await this.recordTestStatus(now, 'ok', null, actorId);
      return {
        success: true,
        provider: 'smtp',
        message: sendgridError
          ? `SendGrid failed (${sendgridError}), but fallback SMTP sent the test email to ${dto.testEmail}.`
          : `Test email sent to ${dto.testEmail} via SMTP (${effective.host}).`,
        testedAt: now,
      };
    } catch (error) {
      const smtpErr =
        error instanceof Error ? error.message : 'SMTP delivery failed.';
      const combined = sendgridError
        ? `SendGrid: ${sendgridError} | SMTP: ${smtpErr}`
        : smtpErr;
      await this.recordTestStatus(now, 'failed', combined, actorId);
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: combined,
        errors: { connection: 'testFailed' },
      });
    }
  }

  private async recordTestStatus(
    now: Date,
    status: 'ok' | 'failed',
    errorMessage: string | null,
    actorId: string | null,
  ): Promise<void> {
    await this.prisma.mailConnectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        lastTestedAt: now,
        lastTestStatus: status,
        lastTestError: errorMessage,
        updatedById: actorId,
      },
      update: {
        lastTestedAt: now,
        lastTestStatus: status,
        lastTestError: errorMessage,
        ...(actorId ? { updatedById: actorId } : {}),
      },
    });
  }

  private safeDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return decryptSecret(value);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt mail secret: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private resolveSecretUpdate(
    incoming: string | undefined,
    existing: string | null,
  ): string | null {
    if (incoming === undefined) return existing;
    const trimmed = incoming.trim();
    if (trimmed === '') return existing;
    return trimmed;
  }
}
