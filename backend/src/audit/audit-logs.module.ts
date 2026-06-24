import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsInterceptor } from './audit-logs.interceptor';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogsInterceptor,
    },
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
