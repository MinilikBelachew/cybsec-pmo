import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsModule } from '../alerts/alerts.module';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule, AlertsModule],
  controllers: [RisksController],
  providers: [RisksService],
  exports: [RisksService],
})
export class RisksModule {}
