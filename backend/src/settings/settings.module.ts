import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AuditArchiveModule } from '../audit/archive/audit-archive.module';
import { AppSettingsService } from './app-settings.service';
import { AllocationPolicyService } from './allocation-policy.service';
import { SessionSecurityPolicyService } from './session-security-policy.service';
import { TimesheetEscalationPolicyService } from './timesheet-escalation-policy.service';
import { CostFormulaService } from './cost-formula.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => AuditArchiveModule)],
  controllers: [SettingsController],
  providers: [
    AppSettingsService,
    AllocationPolicyService,
    SessionSecurityPolicyService,
    TimesheetEscalationPolicyService,
    CostFormulaService,
  ],
  exports: [
    AppSettingsService,
    AllocationPolicyService,
    SessionSecurityPolicyService,
    TimesheetEscalationPolicyService,
    CostFormulaService,
  ],
})
export class SettingsModule {}
