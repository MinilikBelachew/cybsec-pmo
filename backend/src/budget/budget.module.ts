import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { AlertsModule } from '../alerts/alerts.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetOverrunService } from './budget-overrun.service';

@Module({
  imports: [PrismaModule, CaslModule, AuditLogsModule, AlertsModule],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetOverrunService],
  exports: [BudgetService, BudgetOverrunService],
})
export class BudgetModule {}
