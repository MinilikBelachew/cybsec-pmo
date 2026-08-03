import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';
import { EscalationSlaScheduler } from './escalation-sla.scheduler';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule],
  controllers: [EscalationsController],
  providers: [EscalationsService, EscalationSlaScheduler],
  exports: [EscalationsService],
})
export class EscalationsModule {}
