import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import zohoConfig from './config/zoho.config';
import { ZohoHttpClient } from './client/zoho-http.client';
import { OpportunitySyncService } from './sync/opportunity-sync.service';
import { ClosedWonProvisioningService } from './sync/closed-won-provisioning.service';
import { InvoiceSyncService } from './sync/invoice-sync.service';
import { ZohoConnectionService } from './zoho-connection.service';
import { ZohoController } from './zoho.controller';
import { PaymentDelayAlertService } from './payment-delay-alert.service';
import { PaymentDelayAlertScheduler } from './payment-delay-alert.scheduler';
import { DiscrepancyAlertService } from './discrepancy-alert.service';
import { DiscrepancyAlertScheduler } from './discrepancy-alert.scheduler';
import { ZohoSyncScheduler } from './zoho-sync.scheduler';
import {
  ZohoFailedSyncRetryService,
  ZohoFailedSyncRetryScheduler,
} from './zoho-failed-sync-retry.service';

@Module({})
export class ZohoModule {
  static register(): DynamicModule {
    return {
      module: ZohoModule,
      imports: [
        ConfigModule.forFeature(zohoConfig),
        PrismaModule,
        NotificationsModule,
      ],
      controllers: [ZohoController],
      providers: [
        ZohoHttpClient,
        OpportunitySyncService,
        ClosedWonProvisioningService,
        InvoiceSyncService,
        ZohoConnectionService,
        PaymentDelayAlertService,
        PaymentDelayAlertScheduler,
        DiscrepancyAlertService,
        DiscrepancyAlertScheduler,
        ZohoSyncScheduler,
        ZohoFailedSyncRetryService,
        ZohoFailedSyncRetryScheduler,
      ],
      exports: [ZohoConnectionService, ZohoHttpClient],
    };
  }
}
