import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertEngineService } from './alert-engine.service';
import { AlertScheduler } from './alert-scheduler';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEngineService, AlertScheduler],
  exports: [AlertsService, AlertEngineService],
})
export class AlertsModule {}
