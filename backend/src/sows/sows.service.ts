import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import type { CaslUserContext } from '../casl/casl.types';
import {
  ApproveSowDto,
  SowDocumentDto,
  SowSnapshotDto,
  UpdateSowDto,
} from './dto/sow.dto';
import { buildSowPdf, sowPdfFileName } from './sow-pdf';
import {
  SowSnapshot,
  mergeSowSnapshot,
  parseSowSnapshot,
  toSowSnapshotJson,
} from './sow-snapshot';
import { SowCrmWritebackService } from '../integrations/zoho/sync/sow-crm-writeback.service';

type SowRow = {
  id: string;
  projectId: string;
  opportunityId: string | null;
  creationMode: string;
  sourceDataSnapshot: Prisma.JsonValue | null;
  version: number;
  status: string;
  s3FinalKey: string | null;
  documentLink: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  crmWrittenBackAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class SowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly sowCrmWriteback: SowCrmWritebackService,
  ) {}

  async getForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<SowDocumentDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const sow = await this.prisma.sowDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!sow) {
      throw new NotFoundException('SOW not found for this project');
    }
    return this.toDto(sow);
  }

  async createForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<SowDocumentDto> {
    await this.assertProjectVisible(projectId, caslUser);

    const existing = await this.prisma.sowDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (existing) {
      throw new BadRequestException('SOW already exists for this project');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { customer: { select: { displayName: true } } },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const latestCharter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: {
        scopeSummary: true,
        keyDeliverables: true,
        scopeExclusions: true,
        valueSnapshot: true,
      },
    });

    const value =
      latestCharter?.valueSnapshot != null
        ? latestCharter.valueSnapshot.toString()
        : project.value != null
          ? project.value.toString()
          : null;

    const snapshot: SowSnapshot = {
      customerName: project.customer?.displayName ?? null,
      scope: latestCharter?.scopeSummary ?? null,
      deliverables: latestCharter?.keyDeliverables ?? null,
      exclusions: latestCharter?.scopeExclusions ?? null,
      assumptions: null,
      value,
      currency: project.currency,
      startDate: project.startDate.toISOString().slice(0, 10),
      endDate: project.endDate.toISOString().slice(0, 10),
      billingModel: project.billingModel,
      engagementType: project.engagementType,
      approverSignatureName: null,
    };

    const created = await this.prisma.sowDocument.create({
      data: {
        projectId,
        opportunityId: project.crmOpportunityId ?? null,
        creationMode: 'manual',
        sourceDataSnapshot: toSowSnapshotJson(snapshot),
        version: 1,
        status: 'Draft',
      },
    });

    return this.toDto(created);
  }

  async updateDraft(
    projectId: string,
    dto: UpdateSowDto,
    caslUser: CaslUserContext,
  ): Promise<SowDocumentDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const sow = await this.prisma.sowDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!sow) {
      throw new NotFoundException('SOW not found for this project');
    }
    if (sow.status !== 'Draft') {
      throw new BadRequestException('Only Draft SOWs can be edited');
    }

    const current = parseSowSnapshot(sow.sourceDataSnapshot);
    const next = mergeSowSnapshot(current, {
      customerName: dto.customerName,
      scope: dto.scope,
      deliverables: dto.deliverables,
      exclusions: dto.exclusions,
      assumptions: dto.assumptions,
      value: dto.value,
      currency: dto.currency,
      startDate: dto.startDate,
      endDate: dto.endDate,
      billingModel: dto.billingModel,
      engagementType: dto.engagementType,
    });

    const updated = await this.prisma.sowDocument.update({
      where: { id: sow.id },
      data: {
        sourceDataSnapshot: toSowSnapshotJson(next),
        ...(dto.s3FinalKey !== undefined ? { s3FinalKey: dto.s3FinalKey } : {}),
        ...(dto.documentLink !== undefined
          ? { documentLink: dto.documentLink }
          : {}),
      },
    });

    return this.toDto(updated);
  }

  async approve(
    projectId: string,
    dto: ApproveSowDto,
    caslUser: CaslUserContext,
  ): Promise<SowDocumentDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const signatureName = dto.signatureName?.trim() ?? '';
    if (signatureName.length < 2) {
      throw new BadRequestException(
        'Type your full name to sign and approve this SOW',
      );
    }

    const sow = await this.prisma.sowDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!sow) {
      throw new NotFoundException('SOW not found for this project');
    }
    if (sow.status !== 'Draft') {
      throw new BadRequestException('Only Draft SOWs can be approved');
    }

    const nextSnapshot = mergeSowSnapshot(
      parseSowSnapshot(sow.sourceDataSnapshot),
      { approverSignatureName: signatureName.slice(0, 255) },
    );

    await this.prisma.sowDocument.update({
      where: { id: sow.id },
      data: {
        status: 'Approved',
        approvedBy: caslUser.id,
        approvedAt: new Date(),
        sourceDataSnapshot: toSowSnapshotJson(nextSnapshot),
      },
    });

    try {
      await this.sowCrmWriteback.writeback(sow.id);
    } catch {
      // Writeback failures are tracked via FailedSyncRecord; approval still succeeds.
    }

    const final = await this.prisma.sowDocument.findUnique({
      where: { id: sow.id },
    });
    return this.toDto(final!);
  }

  async exportPdf(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.assertProjectVisible(projectId, caslUser);
    const sow = await this.prisma.sowDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: {
        project: { select: { name: true } },
      },
    });
    if (!sow) {
      throw new NotFoundException('SOW not found for this project');
    }

    const snapshot = parseSowSnapshot(sow.sourceDataSnapshot);
    const buffer = await buildSowPdf({
      projectName: sow.project.name,
      status: sow.status,
      version: sow.version,
      ...snapshot,
      approvedAt: sow.approvedAt ? sow.approvedAt.toISOString() : null,
      generatedAt: new Date().toISOString(),
    });

    return {
      buffer,
      filename: sowPdfFileName(sow.project.name, sow.version),
    };
  }

  async list(caslUser: CaslUserContext): Promise<SowDocumentDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const rows = await this.prisma.sowDocument.findMany({
      where: { project: scopeWhere },
      include: {
        project: {
          select: {
            name: true,
            customer: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return rows.map((row) =>
      this.toDto(row, {
        projectName: row.project.name,
        customerName: row.project.customer?.displayName ?? null,
      }),
    );
  }

  private async assertProjectVisible(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private toDto(
    sow: SowRow,
    listFields?: { projectName: string; customerName: string | null },
  ): SowDocumentDto {
    const snapshot = parseSowSnapshot(sow.sourceDataSnapshot);

    return {
      id: sow.id,
      projectId: sow.projectId,
      opportunityId: sow.opportunityId,
      creationMode: sow.creationMode,
      status: sow.status,
      version: sow.version,
      snapshot: snapshot as SowSnapshotDto,
      s3FinalKey: sow.s3FinalKey,
      documentLink: sow.documentLink,
      approvedBy: sow.approvedBy,
      approvedAt: sow.approvedAt?.toISOString() ?? null,
      crmWrittenBackAt: sow.crmWrittenBackAt?.toISOString() ?? null,
      createdAt: sow.createdAt.toISOString(),
      ...(listFields
        ? {
            projectName: listFields.projectName,
            customerName: listFields.customerName,
          }
        : {}),
    };
  }
}
