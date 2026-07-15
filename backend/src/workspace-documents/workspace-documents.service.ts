import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CreateWorkspaceDocumentDto } from './dto/create-workspace-document.dto';
import { QueryWorkspaceDocumentDto } from './dto/query-workspace-document.dto';
import { QueryPortfolioWorkspaceDocumentDto } from './dto/query-portfolio-workspace-document.dto';
import { WorkspaceDocumentCategory } from './workspace-document.constants';

const DOC_INCLUDE = {
  uploader: { select: { id: true, displayName: true, email: true } },
  phase: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true } },
  task: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
} as const;

export type UploadedFileMeta = {
  storageKey: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

@Injectable()
export class WorkspaceDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  mapDocument<T extends { sizeBytes: bigint | null }>(doc: T) {
    return {
      ...doc,
      sizeBytes: doc.sizeBytes != null ? Number(doc.sizeBytes) : null,
      url: null as string | null,
    };
  }

  /** Shape expected by existing task attachment clients. */
  mapAsTaskAttachment(doc: {
    id: string;
    taskId: string | null;
    uploadedBy: string;
    s3Key: string;
    filename: string;
    mimeType: string | null;
    sizeBytes: bigint | null;
    createdAt: Date;
    uploader: { id: string; displayName: string; email: string };
  }) {
    return {
      id: doc.id,
      taskId: doc.taskId as string,
      uploadedBy: doc.uploadedBy,
      s3Key: doc.s3Key,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes != null ? Number(doc.sizeBytes) : null,
      url: null as string | null,
      createdAt: doc.createdAt,
      uploader: doc.uploader,
    };
  }

  buildCreateData(params: {
    projectId: string;
    category: WorkspaceDocumentCategory;
    uploadedBy: string;
    file: UploadedFileMeta;
    phaseId?: string | null;
    milestoneId?: string | null;
    taskId?: string | null;
    tags?: string[];
    isInternal?: boolean;
  }): Prisma.WorkspaceDocumentUncheckedCreateInput {
    return {
      projectId: params.projectId,
      logicalDocId: randomUUID(),
      version: 1,
      category: params.category,
      phaseId: params.phaseId ?? null,
      milestoneId: params.milestoneId ?? null,
      taskId: params.taskId ?? null,
      filename: params.file.filename,
      s3Key: params.file.storageKey,
      mimeType: params.file.mimeType ?? null,
      sizeBytes:
        params.file.sizeBytes != null ? BigInt(params.file.sizeBytes) : null,
      tags: params.tags ?? [],
      isInternal: params.isInternal ?? true,
      uploadedBy: params.uploadedBy,
    };
  }

  async assertProjectInScope(
    projectId: string,
    caslUser: CaslUserContext,
    action: 'read' | 'update' | 'create' = 'read',
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        AND: [{ id: projectId }, this.recordScopeWhere.projectWhere(caslUser, action)],
      },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { project: 'projectNotFound' },
      });
    }
  }

  async listForProject(
    projectId: string,
    query: QueryWorkspaceDocumentDto,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser, 'read');

    const where: Prisma.WorkspaceDocumentWhereInput = {
      projectId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.phaseId ? { phaseId: query.phaseId } : {}),
      ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
    };

    const docs = await this.prisma.workspaceDocument.findMany({
      where,
      include: DOC_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => this.mapDocument(d));
  }

  private buildVaultWhere(
    query: QueryPortfolioWorkspaceDocumentDto,
    caslUser: CaslUserContext,
  ): Prisma.WorkspaceDocumentWhereInput {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const search = query.search?.trim();

    return {
      AND: [
        { project: projectScope },
        ...(query.projectId ? [{ projectId: query.projectId }] : []),
        ...(query.category ? [{ category: query.category }] : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    filename: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    tags: {
                      has: search,
                    },
                  },
                  {
                    project: {
                      name: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
  }

  /**
   * Portfolio Document Vault list — scoped by project visibility
   * (all / own_projects / assigned / team, etc.).
   */
  async findManyWithPagination(
    query: QueryPortfolioWorkspaceDocumentDto,
    caslUser: CaslUserContext,
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    let limit = query.limit && query.limit > 0 ? query.limit : 50;
    if (limit > 100) {
      limit = 100;
    }

    const docs = await this.prisma.workspaceDocument.findMany({
      where: this.buildVaultWhere(query, caslUser),
      include: DOC_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return docs.map((d) => this.mapDocument(d));
  }

  async countMany(
    query: QueryPortfolioWorkspaceDocumentDto,
    caslUser: CaslUserContext,
  ) {
    return this.prisma.workspaceDocument.count({
      where: this.buildVaultWhere(query, caslUser),
    });
  }

  async getVaultStats(caslUser: CaslUserContext) {
    const projectScope = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const where: Prisma.WorkspaceDocumentWhereInput = {
      project: projectScope,
    };

    const [total, byCategory] = await Promise.all([
      this.prisma.workspaceDocument.count({ where }),
      this.prisma.workspaceDocument.groupBy({
        by: ['category'],
        where,
        _count: { _all: true },
      }),
    ]);

    const categoryCounts: Record<string, number> = {};
    for (const row of byCategory) {
      categoryCounts[row.category] = row._count._all;
    }

    return {
      total,
      project: categoryCounts.Project ?? 0,
      phase: categoryCounts.Phase ?? 0,
      milestone: categoryCounts.Milestone ?? 0,
      signOff: categoryCounts.SignOff ?? 0,
      technical: categoryCounts.Technical ?? 0,
      task: categoryCounts.Task ?? 0,
    };
  }

  async createForProject(
    projectId: string,
    dto: CreateWorkspaceDocumentDto,
    uploaderId: string,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser, 'update');
    await this.validateCategoryLinks(projectId, dto);

    const created = await this.prisma.workspaceDocument.create({
      data: this.buildCreateData({
        projectId,
        category: dto.category,
        uploadedBy: uploaderId,
        file: {
          storageKey: dto.storageKey,
          filename: dto.filename,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
        },
        phaseId: dto.phaseId,
        milestoneId: dto.milestoneId,
        taskId: dto.taskId,
        tags: dto.tags,
        isInternal: dto.isInternal,
      }),
      include: DOC_INCLUDE,
    });

    return this.mapDocument(created);
  }

  async removeForProject(
    projectId: string,
    documentId: string,
    caslUser: CaslUserContext,
  ) {
    await this.assertProjectInScope(projectId, caslUser, 'update');

    const existing = await this.prisma.workspaceDocument.findFirst({
      where: { id: documentId, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { document: 'documentNotFound' },
      });
    }

    await this.prisma.workspaceDocument.delete({ where: { id: documentId } });
  }

  async listForTask(taskId: string) {
    const docs = await this.prisma.workspaceDocument.findMany({
      where: { taskId, category: 'Task' },
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => this.mapAsTaskAttachment(d));
  }

  async createForTask(
    task: { id: string; projectId: string },
    file: UploadedFileMeta,
    uploaderId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const created = await client.workspaceDocument.create({
      data: this.buildCreateData({
        projectId: task.projectId,
        category: 'Task',
        uploadedBy: uploaderId,
        file,
        taskId: task.id,
      }),
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
    });
    return this.mapAsTaskAttachment(created);
  }

  async removeForTask(taskId: string, documentId: string) {
    const existing = await this.prisma.workspaceDocument.findFirst({
      where: { id: documentId, taskId, category: 'Task' },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { attachment: 'attachmentNotFound' },
      });
    }
    await this.prisma.workspaceDocument.delete({ where: { id: documentId } });
  }

  private async validateCategoryLinks(
    projectId: string,
    dto: CreateWorkspaceDocumentDto,
  ) {
    if (dto.category === 'Phase') {
      if (!dto.phaseId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { phaseId: 'phaseIdRequired' },
        });
      }
      const phase = await this.prisma.projectPhase.findFirst({
        where: { id: dto.phaseId, projectId },
        select: { id: true },
      });
      if (!phase) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { phaseId: 'phaseNotFound' },
        });
      }
    }

    if (dto.category === 'Milestone') {
      if (!dto.milestoneId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { milestoneId: 'milestoneIdRequired' },
        });
      }
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: { id: dto.milestoneId, projectId },
        select: { id: true },
      });
      if (!milestone) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { milestoneId: 'milestoneNotFound' },
        });
      }
    }

    if (dto.category === 'Task') {
      if (!dto.taskId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { taskId: 'taskIdRequired' },
        });
      }
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, projectId },
        select: { id: true },
      });
      if (!task) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { taskId: 'taskNotFound' },
        });
      }
    }

    if (dto.category !== 'Phase' && dto.phaseId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { phaseId: 'phaseIdOnlyForPhaseCategory' },
      });
    }

    if (dto.category !== 'Milestone' && dto.milestoneId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { milestoneId: 'milestoneIdOnlyForMilestoneCategory' },
      });
    }
  }
}
