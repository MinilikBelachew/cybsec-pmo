import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { HealthRulesService } from './health/health-rules.service';
import {
  buildReportDocx,
} from './templates/cybersec-sample-docx';
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
  ) {}

  async generate(
    reportType: StatusReportType,
    projectId: string,
    userId: string,
  ) {
    const [health, project, milestones, actionPoints, missingData, previous] =
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
        this.prisma.generatedReport.findFirst({
          where: { projectId, reportType },
          orderBy: { version: 'desc' },
          select: { version: true },
        }),
      ]);
    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const periodLabel =
      reportType === 'WSR'
        ? `Week of ${now.toISOString().slice(0, 10)}`
        : `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;

    const snapshot: ReportSnapshot = {
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
      orderBy: { generatedAt: 'desc' },
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

  async approve(id: string, userId: string) {
    await this.get(id);
    return this.prisma.generatedReport.update({
      where: { id },
      data: { status: 'Approved', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async markDistributed(id: string) {
    await this.get(id);
    return this.prisma.generatedReport.update({
      where: { id },
      data: { status: 'Distributed', distributedAt: new Date() },
    });
  }

  async exportPdf(id: string) {
    const report = await this.get(id);
    const snapshot = this.asSnapshot(report);
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
    const snapshot = this.asSnapshot(report);
    const buffer = await buildReportDocx(snapshot);
    const relativePath = path.join('uploads', 'reports', `${id}.docx`);
    await this.writeExport(relativePath, buffer);
    await this.prisma.generatedReport.update({
      where: { id },
      data: { s3DocxKey: relativePath.replace(/\\/g, '/') },
    });
    return buffer;
  }

  private asSnapshot(report: {
    reportType: string;
    dataSnapshot: Prisma.JsonValue | null;
    project?: { name: string } | null;
  }): ReportSnapshot {
    const raw = (report.dataSnapshot ?? {}) as Partial<ReportSnapshot>;
    return {
      title: raw.title ?? `${report.reportType} report`,
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
      reportType: (raw.reportType ?? report.reportType) as ReportSnapshot['reportType'],
      projectName: raw.projectName ?? report.project?.name,
      periodLabel: raw.periodLabel,
      health: raw.health ?? { overallRag: 'amber', dimensions: [] },
      milestones: raw.milestones ?? [],
      actionPoints: raw.actionPoints ?? [],
      missingData: raw.missingData ?? [],
    };
  }

  private async writeExport(relativePath: string, buffer: Buffer) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }
}
