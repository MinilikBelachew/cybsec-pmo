export type MailConfig = {
  port: number;
  host?: string;
  user?: string;
  password?: string;
  defaultEmail?: string;
  defaultName?: string;
  ignoreTLS: boolean;
  secure: boolean;
  requireTLS: boolean;
  /** When set and sendgridEnabled, SendGrid is the primary transport. */
  sendgridApiKey?: string;
  /** When false, SMTP is used even if sendgridApiKey is set. Defaults true. */
  sendgridEnabled: boolean;
};
