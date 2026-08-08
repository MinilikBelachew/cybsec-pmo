import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AuditLogsService } from '../audit/audit-logs.service';
import { PrismaService } from '../database/prisma.service';
import { GeneratedReportsService } from './generated-reports.service';
import {
  GENERATE_SCHEDULED_REPORT_JOB,
  REPORTS_QUEUE,
  ScheduledReportJob,
} from './reports.constants';

@Processor(REPORTS_QUEUE)
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generatedReports: GeneratedReportsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Process(GENERATE_SCHEDULED_REPORT_JOB)
  async handleScheduledReport(job: Job<ScheduledReportJob>) {
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: job.data.scheduleId },
      include: {
        project: { select: { name: true } },
        recipients: {
          include: {
            role: { select: { id: true } },
            contact: { select: { email: true } },
          },
        },
      },
    });
    if (!schedule || !schedule.isActive || !schedule.projectId) return;

    try {
      const report = await this.generatedReports.generate(
        schedule.reportType as 'WSR' | 'MSR',
        schedule.projectId,
        schedule.createdBy,
      );
      const approved = await this.prisma.generatedReport.findFirst({
        where: {
          projectId: schedule.projectId,
          reportType: schedule.reportType,
          status: 'Approved',
          id: { not: report.id },
        },
        orderBy: { approvedAt: 'desc' },
        select: { id: true },
      });
      if (!approved) {
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRun: new Date(),
            lastError: 'No approved report to distribute',
          },
        });
        return report;
      }
      await this.generatedReports.distribute(approved.id, schedule.createdBy);
      await this.prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { lastRun: new Date(), lastError: null },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown report delivery error';
      await this.prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { lastError: message },
      });
      await this.auditLogs.create({
        action: 'REPORT_DELIVERY_FAILED',
        objectType: 'GeneratedReport',
        objectId: null,
        newValue: {
          scheduleId: schedule.id,
          attempt: job.attemptsMade + 1,
          error: message,
        },
        user: { connect: { id: schedule.createdBy } },
      });
      this.logger.error(
        `Scheduled report ${schedule.id} failed (attempt ${job.attemptsMade + 1})`,
        error,
      );
      throw error;
    }
  }
}
