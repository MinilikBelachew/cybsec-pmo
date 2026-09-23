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
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../database/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { HealthRulesService } from './health/health-rules.service';
import {
  ReportSectionsService,
  resolveReportPeriod,
} from './report-sections.service';
import { buildStatusReportDocx } from './templates/cybersec-format-docx';
import { buildStatusReportPdf } from './templates/cybersec-format-pdf';
import {
  buildDocumentReference,
  buildExportFileName,
  deriveProjectRef,
  formatApprovedDate,
  formatSignatory,
  ragWord,
  resolveBrandProfile,
  type ReportAudience,
} from './templates/cybersec-format.constants';
import type { StatusReportSnapshot } from './templates/cybersec-format.types';
import type { StatusReportType } from './generated-reports.types';

export type { StatusReportType } from './generated-reports.types';

type ReportSnapshot = StatusReportSnapshot;

@Injectable()
export class GeneratedReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthRules: HealthRulesService,
    private readonly mailer: MailerService,
    private readonly auditLogs: AuditLogsService,
    private readonly sections: ReportSectionsService,
    private readonly branding: BrandingService,
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
    const version = (previous?.version ?? 0) + 1;
    const snapshot = await this.buildSnapshot(reportType, projectId, {
      version,
      preparedById: userId,
    });

    return this.prisma.generatedReport.create({
      data: {
        projectId,
        reportType,
        version,
        status: 'Draft',
        generatedBy: userId,
        dataSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async list(query: {
    projectId?: string;
    reportType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const where = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.reportType ? { reportType: query.reportType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          generator: { select: { id: true, displayName: true } },
          approver: { select: { id: true, displayName: true } },
        },
        orderBy: [
          { generatedAt: 'desc' },
          { version: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return { data, total, page, limit };
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
      fs.rm(path.resolve(process.cwd(), 'uploads', 'reports', `${id}.xlsx`), {
        force: true,
      }),
      fs.rm(path.resolve(process.cwd(), 'uploads', 'reports', `${id}.csv`), {
        force: true,
      }),
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
    const projectId = report.projectId;
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: {
        projectId,
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
            where: {
              isActive: true,
              roleId: { in: roleIds },
              OR: [
                {
                  employees: {
                    is: {
                      allocations: {
                        some: {
                          projectId,
                          status: 'Active',
                        },
                      },
                    },
                  },
                },
                {
                  primaryProjects: {
                    some: { id: projectId },
                  },
                },
                {
                  secondaryProjects: {
                    some: { id: projectId },
                  },
                },
              ],
            },
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
        where: { id: projectId },
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
    const filename = await this.buildExportFileName(id, 'pdf');
    await this.mailer.sendMail({
      to: recipients,
      subject: `${report.reportType} - ${project?.name ?? 'Project'}`,
      html: '<p>Your approved project status report is attached.</p>',
      attachments: [
        {
          filename,
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

  async exportPdf(id: string, audience: ReportAudience = 'internal') {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report, audience);
    return buildStatusReportPdf(snapshot);
  }

  async exportDocx(id: string, audience: ReportAudience = 'internal') {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report, audience);
    return buildStatusReportDocx(snapshot);
  }

  async exportExcel(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cybsec PMO';
    workbook.created = new Date();

    const addSheet = (
      name: string,
      columns: Array<{ header: string; width: number }>,
      rows: Array<Array<string | number | null>>,
      emptyMessage: string,
    ) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map((column) => ({
        header: column.header,
        width: column.width,
      }));
      if (rows.length) {
        for (const row of rows) sheet.addRow(row);
      } else {
        sheet.addRow([emptyMessage]);
      }
      sheet.getRow(1).font = { bold: true };
      return sheet;
    };

    addSheet(
      'Document control',
      [
        { header: 'Field', width: 24 },
        { header: 'Value', width: 52 },
      ],
      [
        ['Document reference', snapshot.control.documentRef],
        ['Version', `v${snapshot.control.version}`],
        ['Project name', snapshot.control.projectName],
        ['Customer', snapshot.control.customer],
        ['Delivered by', snapshot.control.deliveredBy],
        ['Report period', snapshot.control.reportPeriod],
        ['Date issued', formatApprovedDate(snapshot.control.dateIssued)],
        ['Prepared by', snapshot.control.preparedBy],
        ['Reviewed by', snapshot.control.reviewedBy],
      ],
      'No document control available',
    );

    addSheet(
      'Health',
      [
        { header: 'Dimension', width: 18 },
        { header: 'Status', width: 12 },
        { header: 'Score', width: 10 },
        { header: 'Previous status', width: 16 },
        { header: 'Previous score', width: 14 },
      ],
      [
        ...snapshot.health.dimensions.map((item) => [
          item.dimension,
          ragWord(item.ragStatus),
          Math.round(item.score),
          item.previousRag ? ragWord(item.previousRag) : null,
          item.previousScore == null ? null : Math.round(item.previousScore),
        ]),
        [
          'Overall',
          ragWord(snapshot.health.overallRag),
          null,
          snapshot.health.previousOverallRag
            ? ragWord(snapshot.health.previousOverallRag)
            : null,
          null,
        ],
      ],
      'No health dimensions available',
    );

    addSheet(
      'Milestones',
      [
        { header: 'Milestone', width: 36 },
        { header: 'Status', width: 14 },
        { header: 'Baseline date', width: 18 },
        { header: 'Expected date', width: 18 },
        { header: 'Variance (days)', width: 14 },
        { header: '% complete', width: 12 },
        { header: 'RAG', width: 10 },
      ],
      snapshot.milestones.map((item) => [
        item.title,
        item.status,
        formatApprovedDate(item.baselineDate),
        formatApprovedDate(item.expectedDate),
        item.varianceDays,
        item.percentComplete == null ? null : Math.round(item.percentComplete),
        ragWord(item.ragStatus),
      ]),
      'No milestones reported this period',
    );

    addSheet(
      'Actions',
      [
        { header: 'Action', width: 40 },
        { header: 'Owner', width: 20 },
        { header: 'Due date', width: 18 },
        { header: 'Status', width: 14 },
      ],
      snapshot.actionPoints.map((item) => [
        item.title,
        item.owner,
        formatApprovedDate(item.dueDate),
        item.status,
      ]),
      'No open action points',
    );

    addSheet(
      'Issues',
      [
        { header: 'Issue', width: 40 },
        { header: 'Date reported', width: 18 },
        { header: 'Issue owner', width: 20 },
        { header: 'Target resolution', width: 18 },
        { header: 'Actual resolution', width: 18 },
        { header: 'Status', width: 14 },
      ],
      snapshot.issues.map((item) => [
        item.description,
        formatApprovedDate(item.reportedDate),
        item.issueOwner,
        formatApprovedDate(item.targetResolutionDate),
        item.actualResolutionDate
          ? formatApprovedDate(item.actualResolutionDate)
          : 'Open',
        item.status,
      ]),
      'No issues reported this period',
    );

    addSheet(
      'Risks',
      [
        { header: 'Risk', width: 44 },
        { header: 'Category', width: 16 },
        { header: 'Owner', width: 20 },
        { header: 'Affected milestone', width: 26 },
        { header: 'Raised', width: 10 },
        { header: 'Target date', width: 18 },
        { header: 'Status', width: 14 },
      ],
      snapshot.risks.map((item) => [
        item.description,
        item.category,
        item.owner,
        item.affectedMilestone,
        item.source === 'system' ? 'System' : 'Manual',
        formatApprovedDate(item.targetDate),
        item.status,
      ]),
      'No risks raised against this project',
    );

    addSheet(
      'Pending items',
      [
        { header: 'Item', width: 40 },
        { header: 'Type', width: 10 },
        { header: 'Date requested', width: 18 },
        { header: 'Days waiting', width: 14 },
        { header: 'Owner', width: 20 },
        { header: 'Sitting with', width: 18 },
        { header: 'Holding up', width: 24 },
        { header: 'Last follow-up', width: 18 },
      ],
      snapshot.pendingItems.map((item) => [
        item.item,
        item.type,
        formatApprovedDate(item.requestedDate),
        item.daysWaiting,
        item.owner,
        item.sittingWith,
        item.holdingUp,
        item.lastFollowUp ? formatApprovedDate(item.lastFollowUp) : null,
      ]),
      'No pending items are past their date',
    );

    if (snapshot.audience === 'internal') {
      addSheet(
        'Cost',
        [
          { header: 'Currency', width: 12 },
          { header: 'Baseline', width: 18 },
          { header: 'Actual', width: 18 },
          { header: 'Variance', width: 18 },
          { header: 'Actual effort (hours)', width: 20 },
        ],
        snapshot.cost
          ? [
              [
                snapshot.cost.currency,
                snapshot.cost.baselineAmount,
                snapshot.cost.actualAmount,
                snapshot.cost.varianceAmount,
                snapshot.cost.actualEffortHours,
              ],
            ]
          : [],
        'No baseline budget is recorded for this project',
      );

      addSheet(
        'Missing data',
        [
          { header: 'Type of gap', width: 28 },
          { header: 'Description', width: 60 },
        ],
        snapshot.dataQuality.map((item) => [item.flagType, item.description]),
        'No missing or incomplete data flagged',
      );
    }

    addSheet(
      'Notes',
      [{ header: 'Phases not yet started', width: 40 }],
      snapshot.phasesNotStarted.map((name) => [name]),
      'All project phases have started',
    );

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return buffer;
  }

  async exportCsv(id: string) {
    const report = await this.get(id);
    this.assertDownloadable(report.status);
    const snapshot = await this.resolveSnapshot(report);
    const rows: unknown[][] = [
      ['Section', 'Item', 'Owner', 'Date', 'Status', 'Details'],
      ...snapshot.health.dimensions.map((item) => [
        'Health',
        item.dimension,
        Math.round(item.score),
        '',
        ragWord(item.ragStatus),
        item.previousRag
          ? `Previous ${ragWord(item.previousRag)}`
          : 'No prior report',
      ]),
      ...snapshot.milestones.map((item) => [
        'Milestone',
        item.title,
        '',
        formatApprovedDate(item.expectedDate),
        item.status,
        `Baseline ${formatApprovedDate(item.baselineDate)}; variance ${item.varianceDays ?? '-'} days; ${
          item.percentComplete == null
            ? 'progress not recorded'
            : `${Math.round(item.percentComplete)}% complete`
        }`,
      ]),
      ...snapshot.actionPoints.map((item) => [
        'Action',
        item.title,
        item.owner,
        formatApprovedDate(item.dueDate),
        item.status,
        '',
      ]),
      ...snapshot.issues.map((item) => [
        'Issue',
        item.description,
        item.issueOwner,
        formatApprovedDate(item.targetResolutionDate),
        item.status,
        `Reported ${formatApprovedDate(item.reportedDate)}`,
      ]),
      ...snapshot.risks.map((item) => [
        'Risk',
        item.description,
        item.owner,
        formatApprovedDate(item.targetDate),
        item.status,
        `${item.source === 'system' ? 'System raised' : 'Manually raised'}${
          item.affectedMilestone ? `; affects ${item.affectedMilestone}` : ''
        }`,
      ]),
      ...snapshot.pendingItems.map((item) => [
        'Pending item',
        item.item,
        item.owner,
        formatApprovedDate(item.requestedDate),
        item.type,
        `${item.daysWaiting ?? '-'} days waiting${
          item.holdingUp ? `; holding up ${item.holdingUp}` : ''
        }`,
      ]),
      ...(snapshot.audience === 'internal'
        ? snapshot.dataQuality.map((item) => [
            'Missing data',
            item.flagType,
            '',
            '',
            '',
            item.description,
          ])
        : []),
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
    options: { version?: number; preparedById?: string | null } = {},
  ): Promise<ReportSnapshot> {
    const now = new Date();
    const period = resolveReportPeriod(reportType, now);

    const [
      health,
      project,
      actionPoints,
      milestonesAndPhases,
      issues,
      risks,
      pendingItems,
      cost,
      dataQuality,
      previous,
      preparedBy,
    ] = await Promise.all([
      this.healthRules.evaluateProject(projectId),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          kekaProjectCode: true,
          customer: { select: { displayName: true, companyName: true } },
        },
      }),
      this.prisma.actionPoint.findMany({
        where: { projectId, status: { notIn: ['Done', 'Cancelled'] } },
        orderBy: { dueDate: 'asc' },
        select: {
          title: true,
          dueDate: true,
          status: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.sections.buildMilestonesAndPhases(projectId, period),
      this.sections.buildIssues(projectId, period),
      this.sections.buildRisks(projectId, now),
      this.sections.buildPendingItems(projectId, now),
      this.sections.buildCost(projectId),
      this.sections.buildDataQuality(projectId),
      this.prisma.generatedReport.findFirst({
        where: { projectId, reportType },
        orderBy: { version: 'desc' },
        select: { dataSnapshot: true },
      }),
      options.preparedById
        ? this.prisma.user.findUnique({
            where: { id: options.preparedById },
            select: { displayName: true, role: { select: { label: true } } },
          })
        : null,
    ]);
    if (!project) throw new NotFoundException('Project not found');

    const brand = await this.branding.resolveForProject(projectId);
    const version = options.version ?? 1;
    const projectRef = deriveProjectRef({
      externalCode: project.kekaProjectCode,
      projectId,
    });
    const customer =
      project.customer?.companyName ?? project.customer?.displayName ?? null;
    const priorHealth = this.previousHealth(previous?.dataSnapshot ?? null);

    return {
      docType: reportType,
      audience: 'internal',
      title: `${reportType} — ${project.name}`,
      projectName: project.name,
      periodLabel: period.label,
      generatedAt: now.toISOString(),
      dataAsOf: now.toISOString(),
      brand,
      control: {
        documentRef: buildDocumentReference({
          projectRef,
          docType: reportType,
          date: now,
          version,
        }),
        version,
        projectName: project.name,
        customer,
        deliveredBy: brand.companyName,
        reportPeriod: period.label,
        dateIssued: now.toISOString(),
        preparedBy: formatSignatory(
          preparedBy?.displayName,
          preparedBy?.role?.label,
        ),
        reviewedBy: null,
      },
      health: {
        overallRag: health.overallRag,
        previousOverallRag: priorHealth?.overallRag ?? null,
        overrideReason: null,
        dimensions: health.dimensions.map((item) => {
          const prior = priorHealth?.dimensions.find(
            (row) => row.dimension === item.dimension,
          );
          return {
            dimension: item.dimension,
            score: item.score,
            ragStatus: item.ragStatus,
            previousScore: prior?.score ?? null,
            previousRag: prior?.ragStatus ?? null,
          };
        }),
      },
      milestones: milestonesAndPhases.milestones,
      phaseWork: milestonesAndPhases.phaseWork,
      actionPoints: actionPoints.map((item) => ({
        title: item.title,
        owner: item.owner.displayName,
        dueDate: item.dueDate.toISOString(),
        status: item.status,
      })),
      issues,
      risks,
      pendingItems,
      cost,
      dataQuality,
      phasesNotStarted: milestonesAndPhases.phasesNotStarted,
    };
  }

  /** Prior report's health, printed beside the current values to show direction. */
  private previousHealth(
    dataSnapshot: Prisma.JsonValue | null,
  ): ReportSnapshot['health'] | null {
    if (!dataSnapshot) return null;
    const parsed = (
      typeof dataSnapshot === 'string'
        ? JSON.parse(dataSnapshot)
        : dataSnapshot
    ) as Partial<ReportSnapshot>;
    if (!parsed?.health) return null;
    return {
      overallRag: String(parsed.health.overallRag ?? ''),
      previousOverallRag: null,
      overrideReason: null,
      dimensions: Array.isArray(parsed.health.dimensions)
        ? parsed.health.dimensions
        : [],
    };
  }

  private async resolveSnapshot(
    report: {
      id: string;
      reportType: string;
      version: number;
      projectId: string | null;
      generatedBy: string | null;
      approvedBy: string | null;
      generatedAt: Date;
      dataSnapshot: Prisma.JsonValue | null;
      project?: { name: string } | null;
    },
    audience: ReportAudience = 'internal',
  ): Promise<ReportSnapshot> {
    const reportType = (
      report.reportType === 'MSR' ? 'MSR' : 'WSR'
    ) as StatusReportType;

    const stored = this.asSnapshot(report, reportType);
    const hasUsefulData =
      stored != null &&
      (stored.health.dimensions.length > 0 ||
        stored.milestones.length > 0 ||
        stored.actionPoints.length > 0 ||
        stored.issues.length > 0 ||
        stored.risks.length > 0 ||
        stored.pendingItems.length > 0 ||
        stored.dataQuality.length > 0);

    const base =
      hasUsefulData || !report.projectId
        ? (stored ?? this.emptySnapshot(reportType, report))
        : await this.buildSnapshot(reportType, report.projectId, {
            version: report.version,
            preparedById: report.generatedBy,
          });

    // Signatories and version are read live so an approval after generation shows.
    const [preparedBy, reviewedBy] = await Promise.all([
      this.signatory(report.generatedBy),
      this.signatory(report.approvedBy),
    ]);

    // Brand is always resolved live from the project so a profile change
    // shows on the next export without regenerating the snapshot.
    const brand = report.projectId
      ? await this.branding.resolveForProject(report.projectId)
      : resolveBrandProfile();

    return {
      ...base,
      audience,
      brand,
      cost: audience === 'internal' ? base.cost : null,
      dataQuality: audience === 'internal' ? base.dataQuality : [],
      control: {
        ...base.control,
        version: report.version,
        dateIssued: report.generatedAt.toISOString(),
        documentRef: buildDocumentReference({
          projectRef: base.control.documentRef.split('-')[0],
          docType: reportType,
          date: report.generatedAt,
          version: report.version,
        }),
        preparedBy: preparedBy ?? base.control.preparedBy,
        reviewedBy: reviewedBy ?? base.control.reviewedBy,
      },
    };
  }

  private async signatory(userId: string | null) {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, role: { select: { label: true } } },
    });
    return formatSignatory(user?.displayName, user?.role?.label);
  }

  private asSnapshot(
    report: {
      dataSnapshot: Prisma.JsonValue | null;
      project?: { name: string } | null;
    },
    reportType: StatusReportType,
  ): ReportSnapshot | null {
    if (!report.dataSnapshot) return null;
    const parsed = (
      typeof report.dataSnapshot === 'string'
        ? JSON.parse(report.dataSnapshot)
        : report.dataSnapshot
    ) as Partial<ReportSnapshot>;

    const empty = this.emptySnapshot(reportType, report);
    return {
      ...empty,
      ...parsed,
      docType: reportType,
      audience: 'internal',
      brand: resolveBrandProfile(),
      control: { ...empty.control, ...(parsed.control ?? {}) },
      health: {
        ...empty.health,
        ...(parsed.health ?? {}),
        dimensions: Array.isArray(parsed.health?.dimensions)
          ? parsed.health.dimensions
          : [],
      },
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      phaseWork: Array.isArray(parsed.phaseWork) ? parsed.phaseWork : [],
      actionPoints: Array.isArray(parsed.actionPoints)
        ? parsed.actionPoints
        : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      pendingItems: Array.isArray(parsed.pendingItems)
        ? parsed.pendingItems
        : [],
      dataQuality: Array.isArray(parsed.dataQuality) ? parsed.dataQuality : [],
      phasesNotStarted: Array.isArray(parsed.phasesNotStarted)
        ? parsed.phasesNotStarted
        : [],
      cost: parsed.cost ?? null,
    };
  }

  private emptySnapshot(
    reportType: StatusReportType,
    report: { project?: { name: string } | null },
  ): ReportSnapshot {
    const projectName = report.project?.name ?? 'Project';
    const brand = resolveBrandProfile();
    const now = new Date();
    return {
      docType: reportType,
      audience: 'internal',
      title: `${reportType} — ${projectName}`,
      projectName,
      periodLabel: null,
      generatedAt: now.toISOString(),
      dataAsOf: now.toISOString(),
      brand,
      control: {
        documentRef: buildDocumentReference({
          docType: reportType,
          date: now,
          version: 1,
        }),
        version: 1,
        projectName,
        customer: null,
        deliveredBy: brand.companyName,
        reportPeriod: null,
        dateIssued: now.toISOString(),
        preparedBy: null,
        reviewedBy: null,
      },
      health: {
        overallRag: 'amber',
        previousOverallRag: null,
        overrideReason: null,
        dimensions: [],
      },
      milestones: [],
      phaseWork: [],
      actionPoints: [],
      issues: [],
      risks: [],
      pendingItems: [],
      cost: null,
      dataQuality: [],
      phasesNotStarted: [],
    };
  }

  /** ProjectRef_CustomerName_ProjectName_DocType_Date_vN */
  async buildExportFileName(id: string, extension: string) {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id },
      select: {
        reportType: true,
        version: true,
        generatedAt: true,
        projectId: true,
        project: {
          select: {
            name: true,
            kekaProjectCode: true,
            customer: { select: { displayName: true, companyName: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Generated report not found');
    return buildExportFileName({
      projectRef: report.projectId
        ? deriveProjectRef({
            externalCode: report.project?.kekaProjectCode,
            projectId: report.projectId,
          })
        : null,
      customerName:
        report.project?.customer?.companyName ??
        report.project?.customer?.displayName ??
        null,
      projectName: report.project?.name ?? null,
      docType: report.reportType === 'MSR' ? 'MSR' : 'WSR',
      date: report.generatedAt,
      version: report.version,
      extension,
    });
  }

  private assertDownloadable(status: string) {
    if (
      status !== 'Draft' &&
      status !== 'Approved' &&
      status !== 'Distributed'
    ) {
      throw new BadRequestException(
        'Only draft, approved, or distributed reports can be downloaded',
      );
    }
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }
}
