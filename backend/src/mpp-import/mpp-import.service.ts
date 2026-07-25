import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { ProjectsService } from '../projects/projects.service';
import {
  ApiBillingModel,
  ApiCurrencyCode,
  ApiEngagementType,
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../projects/enums/project-api.enum';
import { MspdiExportBuilder } from './mspdi-export.builder';
import { buildLocalMspdiXml } from './mspdi-export.local';
import { MspdiExportFileResult } from './mspdi-export.types';
import { CreateMppPortfolioImportDto, MppPortfolioProjectCreateDto } from './dto/create-mpp-portfolio-import.dto';
import { MppImportMapper } from './mpp-import.mapper';
import { MppParserClient } from './mpp-parser.client';
import { MppImportPreview, MppImportResultSummary } from './mpp-import.types';

@Injectable()
export class MppImportService {
  private readonly logger = new Logger(MppImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly parserClient: MppParserClient,
    private readonly mapper: MppImportMapper,
    private readonly exportBuilder: MspdiExportBuilder,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Parse the uploaded file and return a non-destructive preview.
   * Nothing is written to the database and no state is kept between calls.
   */
  async preview(
    user: CaslUserContext,
    projectId: string | undefined,
    fileName: string,
    filePath: string,
  ): Promise<MppImportPreview> {
    if (projectId) {
      await this.assertProjectAccessible(user, projectId);
    }

    try {
      const parsed = await this.parserClient.parseFile(filePath, fileName);
      const existingProjects = await this.listAccessibleProjects(user);
      return await this.mapper.buildPreview(parsed, existingProjects);
    } finally {
      await this.safeDeleteFile(filePath);
    }
  }

  /**
   * Parse the uploaded file and write its tasks/dependencies into the project.
   * Runs synchronously and returns a summary of what was created.
   */
  async import(
    user: CaslUserContext,
    projectId: string,
    fileName: string,
    filePath: string,
  ): Promise<MppImportResultSummary> {
    await this.assertProjectAccessible(user, projectId);

    try {
      const parsed = await this.parserClient.parseFile(filePath, fileName);

      if (this.mapper.isPortfolio(parsed)) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        if (!project) {
          throw new BadRequestException('Project not found or not accessible');
        }

        const segment = this.mapper.resolvePortfolioSegmentForProject(
          parsed,
          project.name,
        );
        if (!segment) {
          const { segments } = this.mapper.segmentPortfolio(parsed);
          const names = segments.map((s) => `"${s.projectName}"`).join(', ');
          throw new BadRequestException(
            `Portfolio file has no schedule matching "${project.name}". ` +
              (names
                ? `Projects in file: ${names}. `
                : '') +
              `Open a matching project, or import from the Projects list to create/update all portfolio projects.`,
          );
        }

        return await this.mapper.persistParsedProject(projectId, segment.parsed);
      }

      return await this.mapper.persistParsedProject(projectId, parsed);
    } finally {
      await this.safeDeleteFile(filePath);
    }
  }

  /**
   * Import a portfolio MSPDI (L1 = projects). Match existing projects by
   * case-insensitive name (never duplicate); create missing ones with shared defaults.
   */
  async importPortfolio(
    user: CaslUserContext,
    dto: CreateMppPortfolioImportDto,
    fileName: string,
    filePath: string,
  ): Promise<MppImportResultSummary> {
    try {
      const parsed = await this.parserClient.parseFile(filePath, fileName);
      if (!this.mapper.isPortfolio(parsed)) {
        throw new BadRequestException(
          'File is not a multi-project portfolio. Use the single-project MPP import instead.',
        );
      }

      const { segments, warnings: segmentWarnings } =
        this.mapper.segmentPortfolio(parsed);
      if (segments.length === 0) {
        throw new BadRequestException('No projects found in portfolio file');
      }

      const catalog = await this.listAccessibleProjects(user);
      const byName = new Map(
        catalog.map((project) => [project.name.trim().toLowerCase(), project]),
      );

      let projectsCreated = 0;
      let projectsUpdated = 0;
      const totals: MppImportResultSummary = {
        tasksCreated: 0,
        tasksUpdated: 0,
        dependenciesCreated: 0,
        dependenciesUpdated: 0,
        phasesCreated: 0,
        phasesUpdated: 0,
        resourcesMatched: 0,
        assignmentsSkipped: 0,
        warnings: [...(parsed.warnings ?? []), ...segmentWarnings],
        projectsCreated: 0,
        projectsUpdated: 0,
      };

      for (const segment of segments) {
        const nameKey = segment.projectName.trim().toLowerCase();
        let projectId = byName.get(nameKey)?.id;
        let created = false;

        if (!projectId) {
          const overrides = this.resolvePortfolioProjectOverrides(dto);
          const override = overrides.find(
            (item) =>
              item.name.trim().toLowerCase() ===
              segment.projectName.trim().toLowerCase(),
          );
          const objective = override?.objective?.trim() || dto.objective?.trim();
          const departmentId = override?.departmentId || dto.departmentId;
          const customerId = override?.customerId || dto.customerId;
          const primaryPmId = override?.primaryPmId || dto.primaryPmId;
          const engagementType =
            override?.engagementType || dto.engagementType;
          const billingModel = override?.billingModel || dto.billingModel;
          const priority =
            override?.priority || dto.priority || ApiPriorityLevel.Medium;
          const currency =
            override?.currency || dto.currency || ApiCurrencyCode.USD;
          const rawValue = override?.value ?? dto.value;
          const value =
            rawValue != null && rawValue > 0 ? rawValue : 1;

          const missing: string[] = [];
          if (!objective) missing.push('objective');
          if (!departmentId) missing.push('department');
          if (!customerId) missing.push('customer');
          if (!primaryPmId) missing.push('PM');
          if (!engagementType) missing.push('engagement type');
          if (!billingModel) missing.push('billing model');

          if (missing.length > 0) {
            throw new BadRequestException(
              `Project "${segment.projectName}" does not exist yet. Set ${missing.join(', ')} for that row.`,
            );
          }

          const start = this.parseDateOr(
            segment.startDate,
            new Date(),
          );
          let end = this.parseDateOr(
            segment.finishDate,
            new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
          );
          if (end.getTime() <= start.getTime()) {
            end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
          }

          const createdProject = await this.projectsService.create(
            {
              name: segment.projectName,
              objective: objective!,
              departmentId: departmentId!,
              customerId: customerId!,
              engagementType: engagementType as ApiEngagementType,
              billingModel: billingModel as ApiBillingModel,
              priority: priority as ApiPriorityLevel,
              startDate: start,
              endDate: end,
              value,
              currency: currency as ApiCurrencyCode,
              primaryPmId: primaryPmId!,
              status: ApiProjectStatus.Draft,
            },
            user.id,
          );
          projectId = createdProject.id;
          byName.set(nameKey, { id: projectId, name: segment.projectName });
          created = true;
          projectsCreated += 1;
        } else {
          projectsUpdated += 1;
        }

        const summary = await this.mapper.persistParsedProject(
          projectId,
          segment.parsed,
        );
        totals.tasksCreated += summary.tasksCreated;
        totals.tasksUpdated += summary.tasksUpdated;
        totals.dependenciesCreated += summary.dependenciesCreated;
        totals.dependenciesUpdated += summary.dependenciesUpdated;
        totals.phasesCreated += summary.phasesCreated;
        totals.phasesUpdated += summary.phasesUpdated;
        totals.resourcesMatched += summary.resourcesMatched;
        totals.assignmentsSkipped += summary.assignmentsSkipped;
        totals.warnings.push(
          ...summary.warnings.map((warning) =>
            created
              ? `[${segment.projectName}] ${warning}`
              : `[${segment.projectName} · update] ${warning}`,
          ),
        );
      }

      totals.projectsCreated = projectsCreated;
      totals.projectsUpdated = projectsUpdated;
      totals.warnings.unshift(
        `Portfolio import: ${projectsCreated} project(s) created, ${projectsUpdated} updated (matched by name).`,
      );
      return totals;
    } finally {
      await this.safeDeleteFile(filePath);
    }
  }

  /**
   * Export project schedule as Microsoft Project XML (MSPDI).
   * Uses local MSPDI builder so nested Baseline / % / duration / variance match import.
   * Falls back to mpxj-service only if local build fails. Binary .mpp cannot be written.
   */
  async exportMspdi(
    user: CaslUserContext,
    projectId: string,
  ): Promise<MspdiExportFileResult> {
    await this.assertProjectAccessible(user, projectId);

    const payload = await this.exportBuilder.buildPayload(projectId);
    if (payload.tasks.length === 0) {
      throw new BadRequestException('Project has no tasks to export');
    }

    const safeName =
      payload.project.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'schedule';

    try {
      return {
        filename: `${safeName}.xml`,
        contentType: 'application/xml',
        buffer: buildLocalMspdiXml(payload),
      };
    } catch (error) {
      this.logger.warn(
        `Local MSPDI builder failed, trying mpxj-service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return await this.parserClient.exportMspdi(payload);
    }
  }

  private resolvePortfolioProjectOverrides(
    dto: CreateMppPortfolioImportDto,
  ): MppPortfolioProjectCreateDto[] {
    if (dto.projectsJson?.trim()) {
      try {
        const parsed = JSON.parse(dto.projectsJson) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is MppPortfolioProjectCreateDto =>
              Boolean(
                item &&
                  typeof item === 'object' &&
                  typeof (item as { name?: unknown }).name === 'string' &&
                  (item as { name: string }).name.trim(),
              ),
          );
        }
      } catch (error) {
        this.logger.warn(
          `Invalid projectsJson on portfolio import: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return dto.projects ?? [];
  }

  private async listAccessibleProjects(
    user: CaslUserContext,
  ): Promise<{ id: string; name: string }[]> {
    return this.prisma.project.findMany({
      where: this.recordScopeWhere.projectWhere(user, 'read'),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private parseDateOr(value: string | undefined, fallback: Date): Date {
    if (!value) {
      return fallback;
    }
    const parsed = new Date(
      value.length <= 10 ? `${value}T00:00:00.000Z` : value,
    );
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private async assertProjectAccessible(
    user: CaslUserContext,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.recordScopeWhere.projectWhere(user, 'read'),
      },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException('Project not found or not accessible');
    }
  }

  private async safeDeleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // Ignore missing temp files.
    }
  }
}
