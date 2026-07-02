import { BadRequestException, Injectable } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { MppImportMapper } from './mpp-import.mapper';
import { MppParserClient } from './mpp-parser.client';
import { MppImportPreview, MppImportResultSummary } from './mpp-import.types';

@Injectable()
export class MppImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly parserClient: MppParserClient,
    private readonly mapper: MppImportMapper,
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
    // When importing as a NEW project there is no target yet, so only check
    // access when an existing project was supplied (task-level import).
    if (projectId) {
      await this.assertProjectAccessible(user, projectId);
    }

    try {
      const parsed = await this.parserClient.parseFile(filePath, fileName);
      return await this.mapper.buildPreview(parsed);
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
      return await this.mapper.persistParsedProject(projectId, parsed);
    } finally {
      await this.safeDeleteFile(filePath);
    }
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
