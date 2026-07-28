import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogsService } from '../audit/audit-logs.service';
import { PrismaService } from '../database/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { HealthRulesService } from './health/health-rules.service';
import { buildReportDocx } from './templates/cybersec-sample-docx';
import {
  buildReportPdf,
  type ReportSnapshot,
} from './templates/cybersec-sample-pdf';
import type { StatusReportType } from './generated-reports.types';

export type { StatusReportType } from './generated-reports.types';

@Injectable()
export class GeneratedReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthRules: HealthRulesService,
    private readonly mailer: MailerService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async generate(
    reportType: StatusReportType,
    projectId: string,
    userId: string,
  ) {
    const previous = await this.prisma.generatedReport.findFirst({
      where: { projectId, reportType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const snapshot = await this.buildSnapshot(reportType, projectId);

    return this.prisma.generatedReport.create({
      data: {
        projectId,
        reportType,
        version: (previous?.version ?? 0) + 1,
        status: 'Draft',
        generatedBy: userId,
        dataSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  list(query: { projectId?: string; reportType?: string; status?: string }) {
    return this.prisma.generatedReport.findMany({
      where: {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.reportType ? { reportType: query.reportType } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        generator: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
      },
      orderBy: [
        { projectId: 'asc' },
        { reportType: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async get(id: string) {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!report) throw new NotFoundException('Generated report not found');
    return report;
  }

  async delete(id: string) {
    const report = await this.get(id);
    await this.prisma.generatedReport.delete({ where: { id } });
    await Promise.allSettled([
      report.s3PdfKey
        ? fs.unlink(path.resolve(process.cwd(), report.s3PdfKey))
        : Promise.resolve(),
      report.s3DocxKey
        ? fs.unlink(path.resolve(process.cwd(), report.s3DocxKey))
        : Promise.resolve(),
      fs.unlink(
        path.resolve(process.cwd(), 'uploads', 'reports', `${id}.xlsx`),
      ),
      fs.unlink(
        path.resolve(process.cwd(), 'uploads', 'reports', `${id}.csv`),
      ),
    ]);
    return { id, deleted: true };
  }

  async approve(id: string, userId: string) {
    await this.get(id);
    return this.prisma.generatedReport.update({
      where: { id },
      data: { status: 'Approved', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async markDistributed(id: string) {
    await this.assertApprovedForDistribution(id);
    return this.prisma.generatedReport.update({
      where: { id },
      data: { status: 'Distributed', distributedAt: new Date() },
    });
  }

  async distribute(id: string, userId: string) {
    const report = await this.assertApprovedForDistribution(id);
    if (!report.projectId) {
      throw new BadRequestException('Report is not linked to a project');
    }
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: {
        projectId: report.projectId,
        reportType: report.reportType,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      include: { recipients: true },
    });
    const roleIds = (schedule?.recipients ?? [])
      .map((recipient) => recipient.roleId)
      .filter((roleId): roleId is number => roleId != null);
    const contactIds = (schedule?.recipients ?? [])
      .map((recipient) => recipient.contactId)
      .filter((contactId): contactId is string => contactId != null);
    const [roleUsers, contacts, project] = await Promise.all([
      roleIds.length
        ? this.prisma.user.findMany({
            where: { roleId: { in: roleIds }, isActive: true },
            select: { email: true },
          })
        : [],
      contactIds.length
        ? this.prisma.customerContact.findMany({
            where: { id: { in: contactIds } },
            select: { email: true },
          })
        : [],
      this.prisma.project.findUnique({
        where: { id: report.projectId },
        select: {
          name: true,
          primaryPm: { select: { email: true } },
        },
      }),
    ]);
    const configuredRecipients = [
      ...roleUsers.map((recipient) => recipient.email),
      ...contacts.map((recipient) => recipient.email),
    ];
    const recipients = [
      ...new Set(
        configuredRecipients.length
          ? configuredRecipients
          : project?.primaryPm.email
            ? [project.primaryPm.email]
            : [],
      ),
    ];
    if (recipients.length === 0) {
      throw new BadRequestException('No report recipients are configured');
    }

    const pdf = await this.exportPdf(id);
    await this.mailer.sendMail({
      to: recipients,
      subject: `${report.reportType} - ${project?.name ?? 'Project'}`,
      html: '<p>Your approved project status report is attached.</p>',
      attachments: [
        {
          filename: `${report.reportType}-${report.version}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
      templatePath: '',
      context: {},
    });
    const distributed = await this.prisma.generatedReport.update({
      where: { id },
      data: { status: 'Distributed', distributedAt: new Date() },
    });
    await this.auditLogs.create({
      action: 'REPORT_DISTRIBUTED',
      objectType: 'GeneratedReport',
      objectId: id,
      newValue: { recipients, reportType: report.reportType },
      user: { connect: { id: userId } },
    });
    return distributed;
  }

  async assertApprovedForDistribution(id: string) {
    const report = await this.get(id);
    if (report.status !== 'Approved') {
      throw new BadRequestException(
        'Report must be approved before distribution',
      );
    }
    return report;
  }

  async exportPdf(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const buffer = await buildReportPdf(snapshot);
    const relativePath = path.join('uploads', 'reports', `${id}.pdf`);
    await this.writeExport(relativePath, buffer);
    await this.prisma.generatedReport.update({
      where: { id },
      data: { s3PdfKey: relativePath.replace(/\\/g, '/') },
    });
    return buffer;
  }

  async exportDocx(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const buffer = await buildReportDocx(snapshot);
    const relativePath = path.join('uploads', 'reports', `${id}.docx`);
    await this.writeExport(relativePath, buffer);
    await this.prisma.generatedReport.update({
      where: { id },
      data: { s3DocxKey: relativePath.replace(/\\/g, '/') },
    });
    return buffer;
  }

  async exportExcel(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cybsec PMO';
    workbook.created = new Date();

    const healthSheet = workbook.addWorksheet('Health');
    healthSheet.columns = [
      { header: 'Dimension', key: 'dimension', width: 18 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'RAG Status', key: 'ragStatus', width: 14 },
    ];
    if (snapshot.health.dimensions.length) {
      for (const item of snapshot.health.dimensions) {
        healthSheet.addRow({
          dimension: String(item.dimension ?? ''),
          score: Number(item.score ?? 0),
          ragStatus: String(item.ragStatus ?? ''),
        });
      }
    } else {
      healthSheet.addRow({
        dimension: '—',
        score: '',
        ragStatus: 'No health dimensions available',
      });
    }
    healthSheet.addRow({
      dimension: 'Overall',
      score: '',
      ragStatus: String(snapshot.health.overallRag ?? ''),
    });
    healthSheet.getRow(1).font = { bold: true };

    const milestoneSheet = workbook.addWorksheet('Milestones');
    milestoneSheet.columns = [
      { header: 'Title', key: 'title', width: 36 },
      { header: 'Target Date', key: 'targetDate', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Weight', key: 'weight', width: 10 },
    ];
    if (snapshot.milestones.length) {
      for (const item of snapshot.milestones) {
        milestoneSheet.addRow({
          title: String(item.title ?? ''),
          targetDate: String(item.targetDate ?? ''),
          status: String(item.status ?? ''),
          weight:
            typeof item.weight === 'number'
              ? item.weight
              : String(item.weight ?? ''),
        });
      }
    } else {
      milestoneSheet.addRow({
        title: '—',
        targetDate: '',
        status: 'No milestones',
        weight: '',
      });
    }
    milestoneSheet.getRow(1).font = { bold: true };

    const actionsSheet = workbook.addWorksheet('Actions');
    actionsSheet.columns = [
      { header: 'Title', key: 'title', width: 28 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    if (snapshot.actionPoints.length) {
      for (const item of snapshot.actionPoints) {
        actionsSheet.addRow({
          title: String(item.title ?? ''),
          owner: String(item.owner ?? ''),
          dueDate: String(item.dueDate ?? ''),
          priority: String(item.priority ?? ''),
          status: String(item.status ?? ''),
        });
      }
    } else {
      actionsSheet.addRow({
        title: '—',
        owner: '',
        dueDate: '',
        priority: '',
        status: 'No open actions',
      });
    }
    actionsSheet.getRow(1).font = { bold: true };

    const missingSheet = workbook.addWorksheet('MissingData');
    missingSheet.columns = [
      { header: 'Flag Type', key: 'flagType', width: 24 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Description', key: 'description', width: 48 },
      { header: 'Flagged At', key: 'flaggedAt', width: 22 },
    ];
    if (snapshot.missingData.length) {
      for (const item of snapshot.missingData) {
        missingSheet.addRow({
          flagType: String(item.flagType ?? ''),
          severity: String(item.severity ?? ''),
          description: String(item.description ?? ''),
          flaggedAt: String(item.flaggedAt ?? ''),
        });
      }
    } else {
      missingSheet.addRow({
        flagType: '—',
        severity: '',
        description: 'No unresolved data-quality flags',
        flaggedAt: '',
      });
    }
    missingSheet.getRow(1).font = { bold: true };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const relativePath = path.join('uploads', 'reports', `${id}.xlsx`);
    await this.writeExport(relativePath, buffer);
    return buffer;
  }

  async exportCsv(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const rows: unknown[][] = [
      [
        'Section',
        'Title / Dimension',
        'Owner / Score',
        'Date',
        'Status',
        'Details',
      ],
      ...snapshot.health.dimensions.map((item) => [
        'Health',
        item.dimension,
        item.score,
        '',
        item.ragStatus,
        '',
      ]),
      ...snapshot.milestones.map((item) => [
        'Milestone',
        item.title,
        '',
        item.targetDate,
        item.status,
        item.weight,
      ]),
      ...snapshot.actionPoints.map((item) => [
        'Action',
        item.title,
        item.owner,
        item.dueDate,
        item.status,
        item.priority,
      ]),
      ...snapshot.missingData.map((item) => [
        'Missing Data',
        item.flagType,
        '',
        item.flaggedAt,
        item.severity,
        item.description,
      ]),
    ];
    return Buffer.from(
      rows
        .map((row) => row.map((value) => this.csvCell(value)).join(','))
        .join('\r\n'),
      'utf8',
    );
  }

  private async buildSnapshot(
    reportType: StatusReportType,
    projectId: string,
  ): Promise<ReportSnapshot> {
    const [health, project, milestones, actionPoints, missingData] =
      await Promise.all([
        this.healthRules.evaluateProject(projectId),
        this.prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        }),
        this.prisma.projectMilestone.findMany({
          where: { projectId },
          orderBy: { targetDate: 'asc' },
          select: { title: true, targetDate: true, status: true, weight: true },
        }),
        this.prisma.actionPoint.findMany({
          where: {
            projectId,
            status: { notIn: ['Done', 'Cancelled'] },
          },
          orderBy: { dueDate: 'asc' },
          select: {
            title: true,
            dueDate: true,
            priority: true,
            status: true,
            owner: { select: { displayName: true } },
          },
        }),
        this.prisma.dataQualityFlag.findMany({
          where: { projectId, isResolved: false },
          orderBy: { flaggedAt: 'desc' },
          select: {
            flagType: true,
            severity: true,
            description: true,
            flaggedAt: true,
          },
        }),
      ]);
    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const periodLabel =
      reportType === 'WSR'
        ? `Week of ${now.toISOString().slice(0, 10)}`
        : `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;

    return {
      title: `${reportType} — ${project.name}`,
      generatedAt: now.toISOString(),
      reportType,
      projectName: project.name,
      periodLabel,
      health: {
        overallRag: health.overallRag,
        dimensions: health.dimensions.map((item) => ({
          dimension: item.dimension,
          score: item.score,
          ragStatus: item.ragStatus,
        })),
      },
      milestones: milestones.map((item) => ({
        title: item.title,
        targetDate: item.targetDate.toISOString().slice(0, 10),
        status: item.status,
        weight: item.weight == null ? null : Number(item.weight),
      })),
      actionPoints: actionPoints.map((item) => ({
        title: item.title,
        owner: item.owner.displayName,
        dueDate: item.dueDate.toISOString().slice(0, 10),
        priority: item.priority,
        status: item.status,
      })),
      missingData: missingData.map((item) => ({
        flagType: item.flagType,
        severity: item.severity,
        description: item.description,
        flaggedAt: item.flaggedAt.toISOString(),
      })),
    };
  }

  private async resolveSnapshot(report: {
    reportType: string;
    projectId: string | null;
    dataSnapshot: Prisma.JsonValue | null;
    project?: { name: string } | null;
  }): Promise<ReportSnapshot> {
    const snapshot = this.asSnapshot(report);
    const hasUsefulData =
      snapshot.health.dimensions.length > 0 ||
      snapshot.milestones.length > 0 ||
      snapshot.actionPoints.length > 0 ||
      snapshot.missingData.length > 0;
    if (hasUsefulData || !report.projectId) return snapshot;

    const rebuilt = await this.buildSnapshot(
      (report.reportType === 'MSR' ? 'MSR' : 'WSR') as StatusReportType,
      report.projectId,
    );
    return {
      ...rebuilt,
      title: snapshot.title || rebuilt.title,
      generatedAt: snapshot.generatedAt || rebuilt.generatedAt,
      periodLabel: snapshot.periodLabel || rebuilt.periodLabel,
    };
  }

  private asSnapshot(report: {
    reportType: string;
    dataSnapshot: Prisma.JsonValue | null;
    project?: { name: string } | null;
  }): ReportSnapshot {
    const parsed =
      typeof report.dataSnapshot === 'string'
        ? (JSON.parse(report.dataSnapshot) as Partial<ReportSnapshot>)
        : ((report.dataSnapshot ?? {}) as Partial<ReportSnapshot>);
    const health = parsed.health ?? { overallRag: 'amber', dimensions: [] };
    return {
      title: parsed.title ?? `${report.reportType} report`,
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      reportType: (parsed.reportType ??
        report.reportType) as ReportSnapshot['reportType'],
      projectName: parsed.projectName ?? report.project?.name,
      periodLabel: parsed.periodLabel,
      health: {
        overallRag: String(health.overallRag ?? 'amber'),
        dimensions: Array.isArray(health.dimensions) ? health.dimensions : [],
      },
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      actionPoints: Array.isArray(parsed.actionPoints)
        ? parsed.actionPoints
        : [],
      missingData: Array.isArray(parsed.missingData) ? parsed.missingData : [],
    };
  }

  private async writeExport(relativePath: string, buffer: Buffer) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }

  private assertDownloadable(status: string) {
    if (status !== 'Draft' && status !== 'Approved') {
      throw new BadRequestException(
        'Only draft or approved reports can be downloaded',
      );
    }
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }
}
