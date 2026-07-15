import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetApprovalService } from './timesheet-approval.service';
import { TimesheetEscalationService } from './timesheet-escalation.service';
import { TimesheetEscalationScheduler } from './timesheet-escalation.scheduler';
import { TimesheetsService } from './timesheets.service';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule],
  controllers: [TimesheetsController],
  providers: [
    TimesheetsService,
    TimesheetApprovalService,
    TimesheetEscalationService,
    TimesheetEscalationScheduler,
  ],
  exports: [TimesheetsService, TimesheetApprovalService],
})
export class TimesheetsModule {}
