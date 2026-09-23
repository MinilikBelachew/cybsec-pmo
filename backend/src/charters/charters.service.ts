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
  ApproveProjectCharterDto,
  ProjectCharterDto,
  UpdateProjectCharterDto,
} from './dto/charter.dto';
import { buildCharterPdf, charterPdfFileName } from './charter-pdf';

type CharterRow = {
  id: string;
  projectId: string;
  customerId: string | null;
  sourceOrderId: string | null;
  status: string;
  purpose: string | null;
  successCriteria: string | null;
  scopeSummary: string | null;
  scopeExclusions: string | null;
  keyDeliverables: string | null;
  highLevelRisks: string | null;
  milestoneSchedule: string | null;
  valueSnapshot: Prisma.Decimal | null;
  resourceEstimates: string | null;
  stakeholders: string | null;
  pmAuthority: string | null;
  startDate: Date | null;
  endDate: Date | null;
  version: number;
  incompleteFields: Prisma.JsonValue | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  approverSignatureName: string | null;
  createdAt: Date;
};

@Injectable()
export class ChartersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async getForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectCharterDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const charter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!charter) {
      throw new NotFoundException('Charter not found for this project');
    }
    return this.toDto(charter);
  }

  async updateDraft(
    projectId: string,
    dto: UpdateProjectCharterDto,
    caslUser: CaslUserContext,
  ): Promise<ProjectCharterDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const charter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!charter) {
      throw new NotFoundException('Charter not found for this project');
    }
    if (charter.status !== 'Draft') {
      throw new BadRequestException('Only Draft charters can be edited');
    }

    const updated = await this.prisma.projectCharter.update({
      where: { id: charter.id },
      data: {
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.successCriteria !== undefined
          ? { successCriteria: dto.successCriteria }
          : {}),
        ...(dto.scopeSummary !== undefined
          ? { scopeSummary: dto.scopeSummary }
          : {}),
        ...(dto.scopeExclusions !== undefined
          ? { scopeExclusions: dto.scopeExclusions }
          : {}),
        ...(dto.keyDeliverables !== undefined
          ? { keyDeliverables: dto.keyDeliverables }
          : {}),
        ...(dto.highLevelRisks !== undefined
          ? { highLevelRisks: dto.highLevelRisks }
          : {}),
        ...(dto.milestoneSchedule !== undefined
          ? { milestoneSchedule: dto.milestoneSchedule }
          : {}),
        ...(dto.valueSnapshot !== undefined
          ? {
              valueSnapshot:
                dto.valueSnapshot === null
                  ? null
                  : new Prisma.Decimal(dto.valueSnapshot),
            }
          : {}),
        ...(dto.resourceEstimates !== undefined
          ? { resourceEstimates: dto.resourceEstimates }
          : {}),
        ...(dto.stakeholders !== undefined
          ? { stakeholders: dto.stakeholders }
          : {}),
        ...(dto.pmAuthority !== undefined
          ? { pmAuthority: dto.pmAuthority }
          : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.customerId !== undefined
          ? { customerId: dto.customerId }
          : {}),
        ...(dto.incompleteFields !== undefined
          ? {
              incompleteFields:
                dto.incompleteFields === null
                  ? Prisma.JsonNull
                  : dto.incompleteFields,
            }
          : {}),
      },
    });

    return this.toDto(updated);
  }

  async approve(
    projectId: string,
    dto: ApproveProjectCharterDto,
    caslUser: CaslUserContext,
  ): Promise<ProjectCharterDto> {
    await this.assertProjectVisible(projectId, caslUser);
    const signatureName = dto.signatureName?.trim() ?? '';
    if (signatureName.length < 2) {
      throw new BadRequestException(
        'Type your full name to sign and approve this charter',
      );
    }

    const charter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    if (!charter) {
      throw new NotFoundException('Charter not found for this project');
    }
    if (charter.status !== 'Draft') {
      throw new BadRequestException('Only Draft charters can be approved');
    }

    const updated = await this.prisma.projectCharter.update({
      where: { id: charter.id },
      data: {
        status: 'Approved',
        approvedBy: caslUser.id,
        approvedAt: new Date(),
        approverSignatureName: signatureName.slice(0, 255),
        incompleteFields: Prisma.JsonNull,
      },
    });

    return this.toDto(updated);
  }

  async exportPdf(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.assertProjectVisible(projectId, caslUser);
    const charter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: {
        project: { select: { name: true } },
        customer: { select: { displayName: true } },
      },
    });
    if (!charter) {
      throw new NotFoundException('Charter not found for this project');
    }

    const buffer = await buildCharterPdf({
      projectName: charter.project.name,
      customerName: charter.customer?.displayName ?? null,
      status: charter.status,
      version: charter.version,
      purpose: charter.purpose,
      successCriteria: charter.successCriteria,
      scopeSummary: charter.scopeSummary,
      scopeExclusions: charter.scopeExclusions,
      keyDeliverables: charter.keyDeliverables,
      highLevelRisks: charter.highLevelRisks,
      milestoneSchedule: charter.milestoneSchedule,
      valueSnapshot: charter.valueSnapshot?.toString() ?? null,
      resourceEstimates: charter.resourceEstimates,
      stakeholders: charter.stakeholders,
      pmAuthority: charter.pmAuthority,
      startDate: charter.startDate
        ? charter.startDate.toISOString().slice(0, 10)
        : null,
      endDate: charter.endDate
        ? charter.endDate.toISOString().slice(0, 10)
        : null,
      sourceOrderId: charter.sourceOrderId,
      approverSignatureName: charter.approverSignatureName,
      approvedAt: charter.approvedAt
        ? charter.approvedAt.toISOString()
        : null,
      generatedAt: new Date().toISOString(),
    });

    return {
      buffer,
      filename: charterPdfFileName(charter.project.name, charter.version),
    };
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

  private toDto(charter: CharterRow): ProjectCharterDto {
    const incomplete = Array.isArray(charter.incompleteFields)
      ? (charter.incompleteFields as string[])
      : null;

    return {
      id: charter.id,
      projectId: charter.projectId,
      customerId: charter.customerId,
      sourceOrderId: charter.sourceOrderId,
      status: charter.status,
      purpose: charter.purpose,
      successCriteria: charter.successCriteria,
      scopeSummary: charter.scopeSummary,
      scopeExclusions: charter.scopeExclusions,
      keyDeliverables: charter.keyDeliverables,
      highLevelRisks: charter.highLevelRisks,
      milestoneSchedule: charter.milestoneSchedule,
      valueSnapshot: charter.valueSnapshot?.toString() ?? null,
      resourceEstimates: charter.resourceEstimates,
      stakeholders: charter.stakeholders,
      pmAuthority: charter.pmAuthority,
      startDate: charter.startDate
        ? charter.startDate.toISOString().slice(0, 10)
        : null,
      endDate: charter.endDate
        ? charter.endDate.toISOString().slice(0, 10)
        : null,
      version: charter.version,
      incompleteFields: incomplete,
      approvedBy: charter.approvedBy,
      approvedAt: charter.approvedAt?.toISOString() ?? null,
      approverSignatureName: charter.approverSignatureName,
      createdAt: charter.createdAt.toISOString(),
    };
  }
}
