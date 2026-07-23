import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AuditArchiveModule } from '../audit/archive/audit-archive.module';
import { AppSettingsService } from './app-settings.service';
import { AllocationPolicyService } from './allocation-policy.service';
import { SessionSecurityPolicyService } from './session-security-policy.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => AuditArchiveModule)],
  controllers: [SettingsController],
  providers: [
    AppSettingsService,
    AllocationPolicyService,
    SessionSecurityPolicyService,
  ],
  exports: [
    AppSettingsService,
    AllocationPolicyService,
    SessionSecurityPolicyService,
  ],
})
export class SettingsModule {}
