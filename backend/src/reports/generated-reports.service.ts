import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { HealthRulesService } from './health/health-rules.service';
import { buildReportPdf, ReportSnapshot } from './report-export.util';

export type StatusReportType = 'WSR' | 'MSR';

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

    const snapshot: ReportSnapshot = {
      title: `${reportType} - ${project.name}`,
      generatedAt: new Date().toISOString(),
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
    const buffer = await buildReportPdf(
      report.dataSnapshot as unknown as ReportSnapshot,
    );
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
    const snapshot = report.dataSnapshot as unknown as ReportSnapshot;
    const sections: Paragraph[] = [
      new Paragraph({ text: snapshot.title, heading: HeadingLevel.TITLE }),
      new Paragraph(`Generated ${snapshot.generatedAt}`),
      new Paragraph({
        text: `Health: ${snapshot.health.overallRag}`,
        heading: HeadingLevel.HEADING_1,
      }),
      ...snapshot.health.dimensions.map(
        (item) =>
          new Paragraph(`${item.dimension}: ${item.ragStatus} (${item.score})`),
      ),
    ];
    this.appendDocxSection(sections, 'Milestones', snapshot.milestones);
    this.appendDocxSection(sections, 'Open actions', snapshot.actionPoints);
    this.appendDocxSection(sections, 'Missing data', snapshot.missingData);
    const buffer = await Packer.toBuffer(
      new Document({ sections: [{ children: sections }] }),
    );
    const relativePath = path.join('uploads', 'reports', `${id}.docx`);
    await this.writeExport(relativePath, buffer);
    await this.prisma.generatedReport.update({
      where: { id },
      data: { s3DocxKey: relativePath.replace(/\\/g, '/') },
    });
    return buffer;
  }

  private appendDocxSection(
    target: Paragraph[],
    title: string,
    rows: Array<Record<string, unknown>>,
  ) {
    target.push(
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    );
    if (rows.length === 0) target.push(new Paragraph('None'));
    for (const row of rows) {
      target.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(
              Object.entries(row)
                .filter(([, value]) => value != null)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(' | '),
            ),
          ],
        }),
      );
    }
  }

  private async writeExport(relativePath: string, buffer: Buffer) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }
}
