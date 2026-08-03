import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActionPointsController } from './action-points.controller';
import { ActionPointsPortfolioController } from './action-points-portfolio.controller';
import { ActionPointsService } from './action-points.service';
import { ActionPointsScheduler } from './action-points.scheduler';

@Module({
  imports: [PrismaModule, CaslModule, NotificationsModule],
  controllers: [ActionPointsController, ActionPointsPortfolioController],
  providers: [ActionPointsService, ActionPointsScheduler],
  exports: [ActionPointsService],
})
export class ActionPointsModule {}
