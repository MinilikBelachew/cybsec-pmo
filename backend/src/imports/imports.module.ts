import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { ProjectsModule } from '../projects/projects.module';
import { CaslModule } from '../casl/casl.module';
import { MppImportModule } from '../mpp-import/mpp-import.module';
import { IMPORTS_QUEUE } from './imports.constants';
import { ImportsJobsService } from './imports-jobs.service';
import { ImportsProcessor } from './imports.processor';
import { ImportsController } from './imports.controller';
import { ExcelTasksImportService } from './excel-tasks-import.service';
import { ExcelProjectsImportService } from './excel-projects-import.service';
import { ExcelTasksPreviewService } from './excel-tasks-preview.service';
import { ExcelProjectsPreviewService } from './excel-projects-preview.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuditLogsModule,
    ProjectsModule,
    CaslModule,
    forwardRef(() => MppImportModule),
    BullModule.registerQueue({ name: IMPORTS_QUEUE }),
  ],
  controllers: [ImportsController],
  providers: [
    ImportsJobsService,
    ImportsProcessor,
    ExcelTasksImportService,
    ExcelProjectsImportService,
    ExcelTasksPreviewService,
    ExcelProjectsPreviewService,
  ],
  exports: [ImportsJobsService],
})
export class ImportsModule {}
