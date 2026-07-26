import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';
import { SendgridClient } from './sendgrid.client';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('<p>{{title}}</p>'),
}));

const sendMailMock = jest.fn().mockResolvedValue(undefined);

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}));

describe('MailerService', () => {
  const templatePath = '/fake/template.hbs';
  const baseOptions = {
    to: 'user@example.com',
    subject: 'Hello',
    text: 'Hello text',
    templatePath,
    context: { title: 'Hello' },
  };

  function createService(overrides?: {
    sendgridConfigured?: boolean;
    sendgridSend?: jest.Mock;
  }) {
    const send = overrides?.sendgridSend ?? jest.fn().mockResolvedValue(undefined);
    const sendgridClient = {
      isConfigured: jest
        .fn()
        .mockReturnValue(overrides?.sendgridConfigured ?? false),
      send,
    } as unknown as SendgridClient;

    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'mail.host': 'localhost',
          'mail.port': 1025,
          'mail.ignoreTLS': true,
          'mail.secure': false,
          'mail.requireTLS': false,
          'mail.user': '',
          'mail.password': '',
          'mail.defaultName': 'Api',
          'mail.defaultEmail': 'noreply@example.com',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const service = new MailerService(configService, sendgridClient);
    return { service, sendgridClient, send };
  }

  beforeEach(() => {
    sendMailMock.mockClear();
    sendMailMock.mockResolvedValue(undefined);
  });

  it('uses SMTP only when SendGrid is not configured', async () => {
    const { service, send } = createService({ sendgridConfigured: false });

    await service.sendMail(baseOptions);

    expect(send).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('uses SendGrid and skips SMTP when SendGrid succeeds', async () => {
    const { service, send } = createService({ sendgridConfigured: true });

    await service.sendMail(baseOptions);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Hello text',
        html: '<p>Hello</p>',
      }),
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('falls back to SMTP when SendGrid throws', async () => {
    const send = jest.fn().mockRejectedValue(new Error('SendGrid down'));
    const { service } = createService({
      sendgridConfigured: true,
      sendgridSend: send,
    });

    await service.sendMail(baseOptions);

    expect(send).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('propagates error when SendGrid and SMTP both fail', async () => {
    const send = jest.fn().mockRejectedValue(new Error('SendGrid down'));
    sendMailMock.mockRejectedValueOnce(new Error('SMTP down'));
    const { service } = createService({
      sendgridConfigured: true,
      sendgridSend: send,
    });

    await expect(service.sendMail(baseOptions)).rejects.toThrow('SMTP down');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
});
