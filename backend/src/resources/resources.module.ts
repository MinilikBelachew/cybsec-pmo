import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { ResourcesController } from './resources.controller';
import { TeamDirectoryService } from './team-directory.service';
import { AllocationApprovalService } from './allocation-approval.service';
import { LeaveBackupService } from './leave-backup.service';
import { LeaveBackupScheduler } from './leave-backup.scheduler';
import { LeaveBackupProcessor } from './leave-backup.processor';
import { LEAVE_BACKUP_QUEUE } from './leave-backup.constants';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    SettingsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: LEAVE_BACKUP_QUEUE }),
    forwardRef(() => TasksModule),
  ],
  controllers: [ResourcesController],
  providers: [
    TeamDirectoryService,
    AllocationApprovalService,
    LeaveBackupService,
    LeaveBackupScheduler,
    LeaveBackupProcessor,
  ],
  exports: [TeamDirectoryService, AllocationApprovalService, LeaveBackupService],
})
export class ResourcesModule {}
