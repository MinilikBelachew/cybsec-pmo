import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { SendgridClient } from './sendgrid.client';

@Module({
  providers: [SendgridClient, MailerService],
  exports: [MailerService],
})
export class MailerModule {}
