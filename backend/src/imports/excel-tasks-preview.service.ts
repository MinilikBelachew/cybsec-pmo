import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { ProjectTeamService } from '../projects/project-team.service';
import { ImportsJobsService } from './imports-jobs.service';
import { readExcelSheetAsStringGrid } from './excel-sheet.reader';
import {
  detectTaskCsvImportKind,
  ExcelTaskPreviewRow,
  processRawTaskRows,
} from './excel-tasks-preview.mapper';
import { ExcelTasksImportDto } from './dto/excel-tasks-import.dto';
import { ImportEnqueueResultDto } from './dto/import-job-status.dto';

export const EXCEL_TASKS_PREVIEW_PAGE_SIZE = 50;
const PREVIEW_TTL_SECONDS = 3600;
const PREVIEW_KEY_PREFIX = 'import:preview:tasks:';

export type ExcelTasksPreviewStore = {
  previewId: string;
  userId: string;
  projectId: string;
  createdAt: string;
  fileName: string;
  rows: ExcelTaskPreviewRow[];
  existingTasks: Array<{ id: string; title: string }>;
  counts: {
    total: number;
    valid: number;
    invalid: number;
    create: number;
    update: number;
  };
};

@Injectable()
export class ExcelTasksPreviewService {
  private readonly logger = new Logger(ExcelTasksPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly projectTeam: ProjectTeamService,
    private readonly importsJobs: ImportsJobsService,
  ) {}

  async preview(
    user: CaslUserContext,
    projectId: string,
    file: Express.Multer.File,
  ): Promise<{
    previewId: string;
    counts: ExcelTasksPreviewStore['counts'];
    existingTasks: ExcelTasksPreviewStore['existingTasks'];
    rows: ExcelTaskPreviewRow[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }> {
    this.assertValidFile(file);
    await this.assertProjectAccessible(user, projectId);

    const buffer = file.buffer;
    if (!buffer?.length) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    const grid = await readExcelSheetAsStringGrid(buffer, 'Tasks');
    const kind = detectTaskCsvImportKind(grid);
    if (kind === 'projects') {
      throw new BadRequestException(
        'This file looks like a Projects export. Use Import Projects on the Projects page, or download the Tasks sample XLSX.',
      );
    }
    if (kind === 'unknown') {
      throw new BadRequestException(
        "The uploaded file does not match the expected Tasks format. Please make sure the sheet has headers like 'Title', 'Description', 'Priority', 'Status', etc.",
      );
    }

    const [phases, assignees, existingTasks] = await Promise.all([
      this.prisma.projectPhase.findMany({
        where: { projectId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.projectTeam.findTaskAssignees(projectId, user),
      this.prisma.task.findMany({
        where: { projectId },
        select: { id: true, title: true },
      }),
    ]);

    const rows = processRawTaskRows(
      grid,
      phases,
      assignees.map((a) => ({
        userId: a.userId,
        displayName: a.displayName,
        email: a.email,
        name: a.name,
      })),
      existingTasks,
    );

    const counts = {
      total: rows.length,
      valid: rows.filter((r) => r.errors.length === 0).length,
      invalid: rows.filter((r) => r.errors.length > 0).length,
      create: rows.filter((r) => r.importMode === 'create').length,
      update: rows.filter((r) => r.importMode === 'update').length,
    };

    const previewId = randomUUID();
    const store: ExcelTasksPreviewStore = {
      previewId,
      userId: user.id,
      projectId,
      createdAt: new Date().toISOString(),
      fileName: file.originalname || 'tasks.xlsx',
      rows,
      existingTasks,
      counts,
    };

    await this.saveStore(store);
    this.logger.log(
      `Excel tasks preview ${previewId}: ${counts.total} rows (${counts.valid} valid)`,
    );

    const page = this.sliceRows(rows, 0, EXCEL_TASKS_PREVIEW_PAGE_SIZE);
    return {
      previewId,
      counts,
      existingTasks,
      rows: page.rows,
      total: page.total,
      offset: page.offset,
      limit: page.limit,
      hasMore: page.hasMore,
    };
  }

  async getPage(
    userId: string,
    previewId: string,
    offset = 0,
    limit = EXCEL_TASKS_PREVIEW_PAGE_SIZE,
  ): Promise<{
    rows: ExcelTaskPreviewRow[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }> {
    const store = await this.loadStore(userId, previewId);
    const pageLimit = Math.min(
      Math.max(limit || EXCEL_TASKS_PREVIEW_PAGE_SIZE, 1),
      200,
    );
    return this.sliceRows(store.rows, Math.max(offset || 0, 0), pageLimit);
  }

  async patchRow(
    userId: string,
    previewId: string,
    index: number,
    patch: Record<string, unknown>,
  ): Promise<{ row: ExcelTaskPreviewRow }> {
    const store = await this.loadStore(userId, previewId);
    if (index < 0 || index >= store.rows.length) {
      throw new BadRequestException('Row index out of range.');
    }

    store.rows[index] = {
      ...store.rows[index],
      ...patch,
      errors: Array.isArray(patch.errors)
        ? (patch.errors as string[])
        : store.rows[index].errors,
      warnings: Array.isArray(patch.warnings)
        ? (patch.warnings as string[])
        : store.rows[index].warnings,
    };

    store.counts.valid = store.rows.filter((r) => r.errors.length === 0).length;
    store.counts.invalid = store.rows.length - store.counts.valid;
    store.counts.create = store.rows.filter(
      (r) => r.importMode === 'create',
    ).length;
    store.counts.update = store.rows.filter(
      (r) => r.importMode === 'update',
    ).length;

    await this.saveStore(store);
    return { row: store.rows[index] };
  }

  async confirm(
    userId: string,
    previewId: string,
  ): Promise<ImportEnqueueResultDto> {
    const store = await this.loadStore(userId, previewId);
    const validRows = store.rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      throw new BadRequestException('No valid tasks to import.');
    }

    const dto: ExcelTasksImportDto = {
      projectId: store.projectId,
      rows: validRows.map((row) => ({
        title: row.title,
        description: row.description || undefined,
        priority: row.priority,
        status: row.status,
        startDate: row.startDate || undefined,
        endDate: row.endDate || undefined,
        effortHours: Number.isFinite(row.effortHours)
          ? row.effortHours
          : undefined,
        durationDays: row.durationDays,
        baselineStart: row.baselineStart,
        baselineEnd: row.baselineEnd,
        baselineDurationDays: row.baselineDurationDays,
        actualStart: row.actualStart,
        actualEnd: row.actualEnd,
        progressApproved: row.progressApproved,
        resolvedAssigneeId: row.resolvedAssigneeId ?? null,
        resolvedPhaseId: row.resolvedPhaseId ?? null,
        importMode: row.importMode,
        resolvedTaskId: row.resolvedTaskId,
        predecessors: (row.predecessors ?? []).map((p) => ({
          predecessorTitle: p.title,
          depType: p.depType,
          lagDays: p.lagDays,
        })),
      })),
    };

    const result = await this.importsJobs.enqueueExcelTasksImport(userId, dto);
    await this.redis.del(this.key(previewId));
    return result;
  }

  private sliceRows<T>(
    rows: T[],
    offset: number,
    limit: number,
  ): {
    rows: T[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  } {
    const total = rows.length;
    const sliced = rows.slice(offset, offset + limit);
    return {
      rows: sliced,
      total,
      offset,
      limit,
      hasMore: offset + sliced.length < total,
    };
  }

  private key(previewId: string): string {
    return `${PREVIEW_KEY_PREFIX}${previewId}`;
  }

  private async saveStore(store: ExcelTasksPreviewStore): Promise<void> {
    await this.redis.set(
      this.key(store.previewId),
      JSON.stringify(store),
      PREVIEW_TTL_SECONDS,
    );
  }

  private async loadStore(
    userId: string,
    previewId: string,
  ): Promise<ExcelTasksPreviewStore> {
    const raw = await this.redis.get(this.key(previewId));
    if (!raw) {
      throw new NotFoundException(
        'Import preview expired or not found. Please re-upload the file.',
      );
    }
    const store = JSON.parse(raw) as ExcelTasksPreviewStore;
    if (store.userId !== userId) {
      throw new NotFoundException(
        'Import preview expired or not found. Please re-upload the file.',
      );
    }
    return store;
  }

  private assertValidFile(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Excel file is required.');
    }
    const name = (file.originalname || '').toLowerCase();
    if (!name.endsWith('.xlsx')) {
      throw new BadRequestException('Please upload a valid Excel (.xlsx) file.');
    }
  }

  private async assertProjectAccessible(
    user: CaslUserContext,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.recordScopeWhere.projectWhere(user, 'update'),
      },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException('Project not found or not accessible');
    }
  }
}
