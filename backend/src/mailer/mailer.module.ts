import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { MailerService } from './mailer.service';
import { SendgridClient } from './sendgrid.client';
import { MailConnectionService } from './mail-connection.service';

@Module({
  imports: [PrismaModule],
  providers: [SendgridClient, MailConnectionService, MailerService],
  exports: [MailerService, MailConnectionService],
})
export class MailerModule {}
