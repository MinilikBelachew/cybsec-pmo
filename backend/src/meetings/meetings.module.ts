import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../database/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BrandingModule } from '../branding/branding.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    MailerModule,
    AuditLogsModule,
    NotificationsModule,
    BrandingModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
