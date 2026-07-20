import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { AllConfigType } from '../config/config.type';

export type SendgridMailPayload = {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
};

@Injectable()
export class SendgridClient {
  private readonly logger = new Logger(SendgridClient.name);
  private readonly apiKey?: string;
  private readonly enabled: boolean;
  private initialized = false;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.apiKey = this.configService.get('mail.sendgridApiKey', { infer: true });
    this.enabled =
      this.configService.get('mail.sendgridEnabled', { infer: true }) ?? true;

    if (this.isConfigured()) {
      sgMail.setApiKey(this.apiKey!);
      this.initialized = true;
      this.logger.log('SendGrid client configured as primary mail transport');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.enabled && this.apiKey?.trim());
  }

  async send(payload: SendgridMailPayload): Promise<void> {
    if (!this.isConfigured() || !this.initialized) {
      throw new Error('SendGrid is not configured');
    }

    if (!payload.html && !payload.text) {
      throw new Error('Email content (text or html) is required');
    }

    try {
      await sgMail.send({
        to: payload.to,
        from: payload.from,
        subject: payload.subject,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.html ? { html: payload.html } : {}),
      } as sgMail.MailDataRequired);
    } catch (error) {
      throw new Error(this.formatSendgridError(error, payload.from));
    }
  }

  private formatSendgridError(error: unknown, from: string): string {
    const response = (
      error as { response?: { body?: { errors?: Array<{ message?: string }> } } }
    )?.response?.body;
    const detail = response?.errors
      ?.map((entry) => entry.message)
      .filter(Boolean)
      .join('; ');

    if (detail) {
      return `SendGrid Forbidden/error for from="${from}": ${detail}`;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return `SendGrid send failed for from="${from}": ${message}`;
  }
}
