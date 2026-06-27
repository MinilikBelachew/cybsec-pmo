import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsInterceptor } from './audit-logs.interceptor';
import { AuditExportService } from './audit-export.service';
import { PrismaModule } from '../database/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    AuditExportService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogsInterceptor,
    },
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
