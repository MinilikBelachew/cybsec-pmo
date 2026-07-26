import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MailerService } from '../mailer/mailer.service';
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
    private readonly mailer: MailerService,
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
      const pdf = await this.generatedReports.exportPdf(report.id);
      const roleIds = schedule.recipients
        .map((recipient) => recipient.roleId)
        .filter((id): id is number => id != null);
      const roleUsers =
        roleIds.length === 0
          ? []
          : await this.prisma.user.findMany({
              where: { roleId: { in: roleIds }, isActive: true },
              select: { email: true },
            });
      const to = [
        ...roleUsers.map((user) => user.email),
        ...schedule.recipients
          .map((recipient) => recipient.contact?.email)
          .filter((email): email is string => Boolean(email)),
      ];
      if (to.length > 0) {
        await this.mailer.sendMail({
          to: [...new Set(to)],
          subject: `${schedule.reportType} - ${schedule.project?.name ?? 'Project'}`,
          html: '<p>Your scheduled project status report is attached.</p>',
          attachments: [
            {
              filename: `${schedule.reportType}-${report.version}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
          templatePath: '',
          context: {},
        });
      }
      await this.generatedReports.markDistributed(report.id);
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
      this.logger.error(
        `Scheduled report ${schedule.id} failed (attempt ${job.attemptsMade + 1})`,
        error,
      );
      throw error;
    }
  }
}
