import { DynamicModule, Module, Type } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import kekaConfig from './config/keka.config';
import { KekaHttpClient } from './client/keka-http.client';
import { KekaMockController } from './mock/keka-mock.controller';
import { DepartmentSyncService } from './sync/department-sync.service';
import { EmployeeSyncService } from './sync/employee-sync.service';
import { LeaveSyncService } from './sync/leave-sync.service';
import { KekaSyncService } from './sync/keka-sync.service';
import { KekaSyncProcessor } from './sync/keka-sync.processor';
import { KekaSyncScheduler } from './sync/keka-sync.scheduler';
import { AllocationPushService } from './sync/allocation-push.service';
import { TimesheetPushService } from './sync/timesheet-push.service';
import { KekaIntegrationAdminService } from './keka-integration-admin.service';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { KekaSyncController } from './controllers/keka-sync.controller';
import { KEKA_SYNC_QUEUE } from './keka.constants';
import { LEAVE_BACKUP_QUEUE } from '../resources/leave-backup.constants';

function shouldRegisterMockController(): boolean {
  return (
    process.env.KEKA_MOCK_ENABLED === 'true' && process.env.NODE_ENV !== 'production'
  );
}

@Module({})
export class KekaModule {
  static register(): DynamicModule {
    const controllers: Type<unknown>[] = [KekaSyncController];
    if (shouldRegisterMockController()) {
      controllers.push(KekaMockController);
    }

    return {
      module: KekaModule,
      global: true,
      imports: [
        ConfigModule.forFeature(kekaConfig),
        PrismaModule,
        BullModule.registerQueue({ name: KEKA_SYNC_QUEUE }),
        BullModule.registerQueue({ name: LEAVE_BACKUP_QUEUE }),
      ],
      controllers,
      providers: [
        KekaHttpClient,
        DepartmentSyncService,
        EmployeeSyncService,
        LeaveSyncService,
        KekaSyncService,
        KekaSyncProcessor,
        KekaSyncScheduler,
        AllocationPushService,
        TimesheetPushService,
        KekaIntegrationAdminService,
        EmployeeUserLinkService,
      ],
      exports: [KekaSyncService, KekaHttpClient, AllocationPushService, TimesheetPushService, KekaIntegrationAdminService, EmployeeUserLinkService],
    };
  }
}
