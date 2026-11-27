import { Injectable, Logger, Optional } from '@nestjs/common';
import fs from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { AllConfigType } from '../config/config.type';
import { MailConfig } from '../mail/config/mail-config.type';
import { SendgridAttachment, SendgridClient } from './sendgrid.client';
import { MailConnectionService } from './mail-connection.service';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private transporterSignature: string;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sendgridClient: SendgridClient,
    @Optional() private readonly mailConnectionService?: MailConnectionService,
  ) {
    const initialConfig = this.readEnvMailConfig();
    this.transporterSignature = this.buildSmtpSignature(initialConfig);
    this.transporter = this.createTransporter(initialConfig);
  }

  async sendMail({
    templatePath,
    context,
    ...mailOptions
  }: nodemailer.SendMailOptions & {
    templatePath: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    let html: string | undefined;
    if (templatePath) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, {
        strict: true,
      })(context);
    }

    const effective = this.mailConnectionService
      ? await this.mailConnectionService.getEffectiveConfig()
      : this.readEnvMailConfig();

    const from =
      mailOptions.from ??
      `"${effective.defaultName ?? ''}" <${effective.defaultEmail ?? ''}>`;

    const resolvedHtml = mailOptions.html ? mailOptions.html : html;
    const payload = {
      ...mailOptions,
      from,
      html: resolvedHtml,
    };

    const useDynamicSendgrid = Boolean(
      this.mailConnectionService &&
        effective.sendgridEnabled &&
        effective.sendgridApiKey?.trim(),
    );
    const useStaticSendgrid =
      !this.mailConnectionService && this.sendgridClient.isConfigured();

    if (useDynamicSendgrid || useStaticSendgrid) {
      try {
        const attachments = await this.normalizeAttachments(payload.attachments);
        const sgPayload = {
          to: this.normalizeRecipients(payload.to),
          from: this.normalizeFrom(from),
          subject: String(payload.subject ?? ''),
          text:
            typeof payload.text === 'string' ? payload.text : undefined,
          html:
            typeof resolvedHtml === 'string' ? resolvedHtml : undefined,
          ...(attachments.length > 0 ? { attachments } : {}),
        };
        if (useDynamicSendgrid) {
          await this.sendgridClient.send(sgPayload, effective.sendgridApiKey);
        } else {
          await this.sendgridClient.send(sgPayload);
        }
        this.logger.debug('Email sent via SendGrid');
        return;
      } catch (error) {
        this.logger.warn(
          `SendGrid send failed; falling back to SMTP: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    const transporter = this.getOrRefreshTransporter(effective);
    await transporter.sendMail(payload);
    this.logger.debug('Email sent via SMTP');
  }

  private readEnvMailConfig(): MailConfig {
    return {
      host: this.configService.get('mail.host', { infer: true }),
      port: this.configService.get('mail.port', { infer: true }) ?? 587,
      ignoreTLS:
        this.configService.get('mail.ignoreTLS', { infer: true }) ?? false,
      secure: this.configService.get('mail.secure', { infer: true }) ?? false,
      requireTLS:
        this.configService.get('mail.requireTLS', { infer: true }) ?? false,
      user: this.configService.get('mail.user', { infer: true }),
      password: this.configService.get('mail.password', { infer: true }),
      defaultName: this.configService.get('mail.defaultName', { infer: true }),
      defaultEmail: this.configService.get('mail.defaultEmail', {
        infer: true,
      }),
      sendgridApiKey: this.configService.get('mail.sendgridApiKey', {
        infer: true,
      }),
      sendgridEnabled:
        this.configService.get('mail.sendgridEnabled', { infer: true }) ?? true,
    };
  }

  private buildSmtpSignature(cfg: MailConfig): string {
    return JSON.stringify([
      cfg.host ?? '',
      cfg.port ?? 587,
      Boolean(cfg.ignoreTLS),
      Boolean(cfg.secure),
      Boolean(cfg.requireTLS),
      cfg.user ?? '',
      cfg.password ?? '',
    ]);
  }

  private createTransporter(cfg: MailConfig): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      ignoreTLS: cfg.ignoreTLS,
      secure: cfg.secure,
      requireTLS: cfg.requireTLS,
      auth: {
        user: cfg.user,
        pass: cfg.password,
      },
    });
  }

  private getOrRefreshTransporter(cfg: MailConfig): nodemailer.Transporter {
    const signature = this.buildSmtpSignature(cfg);
    if (signature !== this.transporterSignature) {
      this.transporter = this.createTransporter(cfg);
      this.transporterSignature = signature;
    }
    return this.transporter;
  }

  private async normalizeAttachments(
    attachments?: nodemailer.SendMailOptions['attachments'],
  ): Promise<SendgridAttachment[]> {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }

    const result: SendgridAttachment[] = [];

    for (const item of attachments) {
      let base64Content: string | null = null;

      if (Buffer.isBuffer(item.content)) {
        base64Content = item.content.toString('base64');
      } else if (item.content instanceof Uint8Array) {
        base64Content = Buffer.from(item.content).toString('base64');
      } else if (typeof item.content === 'string') {
        const encoding =
          item.encoding && Buffer.isEncoding(item.encoding)
            ? item.encoding
            : 'utf8';
        base64Content = Buffer.from(item.content, encoding).toString('base64');
      } else if (typeof item.path === 'string' && item.path.trim()) {
        const fileBuffer = await fs.readFile(item.path);
        base64Content = fileBuffer.toString('base64');
      }

      if (!base64Content) {
        continue;
      }

      const filename =
        typeof item.filename === 'string' && item.filename.trim()
          ? item.filename.trim()
          : 'attachment';

      result.push({
        content: base64Content,
        filename,
        ...(typeof item.contentType === 'string' && item.contentType
          ? { type: item.contentType }
          : {}),
        disposition: item.contentDisposition === 'inline' ? 'inline' : 'attachment',
      });
    }

    return result;
  }

  private normalizeRecipients(
    to: nodemailer.SendMailOptions['to'],
  ): string | string[] {
    if (!to) {
      throw new Error('Email recipient (to) is required');
    }
    if (typeof to === 'string') {
      return to;
    }
    if (Array.isArray(to)) {
      return to.map((entry) =>
        typeof entry === 'string' ? entry : entry.address,
      );
    }
    return to.address;
  }

  /** SendGrid expects a plain email or "Name <email>" string. */
  private normalizeFrom(from: nodemailer.SendMailOptions['from']): string {
    if (!from) {
      throw new Error('Email from address is required');
    }
    if (typeof from === 'string') {
      return from;
    }
    if (Array.isArray(from)) {
      const first = from[0];
      if (!first) {
        throw new Error('Email from address is required');
      }
      return typeof first === 'string'
        ? first
        : first.name
          ? `"${first.name}" <${first.address}>`
          : first.address;
    }
    return from.name
      ? `"${from.name}" <${from.address}>`
      : from.address;
  }
}
