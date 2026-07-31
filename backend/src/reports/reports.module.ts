import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { MailerModule } from '../mailer/mailer.module';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { BrandingModule } from '../branding/branding.module';
import { ReportsController } from './reports.controller';
import { UtilisationService } from './utilisation.service';
import { HealthRulesService } from './health/health-rules.service';
import { DataQualityService } from './data-quality/data-quality.service';
import { GeneratedReportsService } from './generated-reports.service';
import { ReportSectionsService } from './report-sections.service';
import { ReportSchedulesService } from './report-schedules.service';
import { ReportsProcessor } from './reports.processor';
import { REPORTS_QUEUE } from './reports.constants';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    MailerModule,
    AuditLogsModule,
    BrandingModule,
    BullModule.registerQueue({ name: REPORTS_QUEUE }),
  ],
  controllers: [ReportsController],
  providers: [
    UtilisationService,
    HealthRulesService,
    DataQualityService,
    GeneratedReportsService,
    ReportSectionsService,
    ReportSchedulesService,
    ReportsProcessor,
  ],
  exports: [UtilisationService, HealthRulesService, DataQualityService],
})
export class ReportsModule {}
