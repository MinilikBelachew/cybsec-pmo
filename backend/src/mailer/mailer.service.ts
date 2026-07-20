import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { AllConfigType } from '../config/config.type';
import { SendgridClient } from './sendgrid.client';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sendgridClient: SendgridClient,
  ) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('mail.host', { infer: true }),
      port: configService.get('mail.port', { infer: true }),
      ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
      secure: configService.get('mail.secure', { infer: true }),
      requireTLS: configService.get('mail.requireTLS', { infer: true }),
      auth: {
        user: configService.get('mail.user', { infer: true }),
        pass: configService.get('mail.password', { infer: true }),
      },
    });
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

    const from =
      mailOptions.from ??
      `"${this.configService.get('mail.defaultName', {
        infer: true,
      })}" <${this.configService.get('mail.defaultEmail', {
        infer: true,
      })}>`;

    const resolvedHtml = mailOptions.html ? mailOptions.html : html;
    const payload = {
      ...mailOptions,
      from,
      html: resolvedHtml,
    };

    if (this.sendgridClient.isConfigured()) {
      try {
        await this.sendgridClient.send({
          to: this.normalizeRecipients(payload.to),
          from: this.normalizeFrom(from),
          subject: String(payload.subject ?? ''),
          text:
            typeof payload.text === 'string' ? payload.text : undefined,
          html:
            typeof resolvedHtml === 'string' ? resolvedHtml : undefined,
        });
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

    await this.transporter.sendMail(payload);
    this.logger.debug('Email sent via SMTP');
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
