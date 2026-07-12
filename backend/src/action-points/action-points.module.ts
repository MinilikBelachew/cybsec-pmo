import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActionPointsController } from './action-points.controller';
import { ActionPointsService } from './action-points.service';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule],
  controllers: [ActionPointsController],
  providers: [ActionPointsService],
  exports: [ActionPointsService],
})
export class ActionPointsModule {}
