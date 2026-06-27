import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SettingsModule } from '../../settings/settings.module';
import { AuditArchiveService } from './audit-archive.service';
import { AuditArchiveScheduler } from './audit-archive.scheduler';

@Module({
  imports: [PrismaModule, forwardRef(() => SettingsModule)],
  providers: [AuditArchiveService, AuditArchiveScheduler],
  exports: [AuditArchiveService],
})
export class AuditArchiveModule {}
