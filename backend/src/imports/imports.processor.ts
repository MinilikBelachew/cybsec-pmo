import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { unlink } from 'fs/promises';
import { PrismaService } from '../database/prisma.service';
import { MppImportService } from '../mpp-import/mpp-import.service';
import { CaslUserContext } from '../casl/casl.types';
import {
  EXCEL_PROJECTS_IMPORT_JOB,
  EXCEL_TASKS_IMPORT_JOB,
  MPP_IMPORT_JOB,
  MPP_PORTFOLIO_IMPORT_JOB,
  IMPORTS_QUEUE,
} from './imports.constants';
import { ImportsJobsService } from './imports-jobs.service';
import { ExcelTasksImportService } from './excel-tasks-import.service';
import { ExcelProjectsImportService } from './excel-projects-import.service';
import {
  ExcelProjectsImportJobData,
  ExcelTasksImportJobData,
  ImportJobData,
  ImportJobResultSummary,
  MppImportJobData,
  MppPortfolioImportJobData,
} from './imports.types';

async function reportProgress(
  job: Job,
  percent: number,
  step?: string,
): Promise<void> {
  await job.progress({
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    step: step ?? null,
  });
}

@Processor(IMPORTS_QUEUE)
export class ImportsProcessor {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(
    private readonly mppImportService: MppImportService,
    private readonly excelTasksImportService: ExcelTasksImportService,
    private readonly excelProjectsImportService: ExcelProjectsImportService,
    private readonly importsJobsService: ImportsJobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process(MPP_IMPORT_JOB)
  async handleMppImport(job: Job<MppImportJobData>): Promise<ImportJobResultSummary> {
    return this.withLockCleanup(job, async () => {
      await reportProgress(job, 5, 'Parsing MS Project file…');
      const user = await this.loadCaslUser(job.data.userId);
      const result = await this.mppImportService.import(
        user,
        job.data.projectId,
        job.data.fileName,
        job.data.filePath,
        { deleteFile: true },
      );
      await reportProgress(job, 100, 'Done');
      return {
        kind: 'mpp',
        tasksCreated: result.tasksCreated,
        tasksUpdated: result.tasksUpdated,
        dependenciesCreated: result.dependenciesCreated,
        dependenciesUpdated: result.dependenciesUpdated,
        phasesCreated: result.phasesCreated,
        phasesUpdated: result.phasesUpdated,
        warnings: result.warnings,
        message: `MPP import: ${result.tasksCreated} tasks created`,
      };
    });
  }

  @Process(MPP_PORTFOLIO_IMPORT_JOB)
  async handleMppPortfolio(
    job: Job<MppPortfolioImportJobData>,
  ): Promise<ImportJobResultSummary> {
    return this.withLockCleanup(job, async () => {
      await reportProgress(job, 5, 'Parsing portfolio…');
      const user = await this.loadCaslUser(job.data.userId);
      const result = await this.mppImportService.importPortfolio(
        user,
        job.data.portfolioDto,
        job.data.fileName,
        job.data.filePath,
        { deleteFile: true },
      );
      await reportProgress(job, 100, 'Done');
      return {
        kind: 'mpp-portfolio',
        projectsCreated: result.projectsCreated,
        projectsUpdated: result.projectsUpdated,
        tasksCreated: result.tasksCreated,
        tasksUpdated: result.tasksUpdated,
        dependenciesCreated: result.dependenciesCreated,
        dependenciesUpdated: result.dependenciesUpdated,
        phasesCreated: result.phasesCreated,
        phasesUpdated: result.phasesUpdated,
        warnings: result.warnings,
        message: `MPP portfolio: ${result.projectsCreated ?? 0} created, ${result.projectsUpdated ?? 0} updated`,
      };
    });
  }

  @Process(EXCEL_TASKS_IMPORT_JOB)
  async handleExcelTasks(
    job: Job<ExcelTasksImportJobData>,
  ): Promise<ImportJobResultSummary> {
    return this.withLockCleanup(job, async () => {
      await reportProgress(job, 1, 'Starting Excel tasks import…');
      return this.excelTasksImportService.run(
        job.data.userId,
        job.data.projectId,
        job.data.rows,
        (percent, step) => reportProgress(job, percent, step),
      );
    });
  }

  @Process(EXCEL_PROJECTS_IMPORT_JOB)
  async handleExcelProjects(
    job: Job<ExcelProjectsImportJobData>,
  ): Promise<ImportJobResultSummary> {
    return this.withLockCleanup(job, async () => {
      await reportProgress(job, 1, 'Starting Excel projects import…');
      return this.excelProjectsImportService.run(job.data, (percent, step) =>
        reportProgress(job, percent, step),
      );
    });
  }

  private async withLockCleanup(
    job: Job<ImportJobData>,
    work: () => Promise<ImportJobResultSummary>,
  ): Promise<ImportJobResultSummary> {
    try {
      return await work();
    } catch (error) {
      this.logger.error(
        `Import job ${job.id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      // Ensure temp MPP files are removed on failure
      const data = job.data;
      if (
        (data.kind === 'mpp' || data.kind === 'mpp-portfolio') &&
        'filePath' in data &&
        data.filePath
      ) {
        await unlink(data.filePath).catch(() => undefined);
      }
      throw error;
    } finally {
      await this.importsJobsService.releaseUserLockAndStartNext(job.data.userId);
    }
  }

  private async loadCaslUser(userId: string): Promise<CaslUserContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        employees: { select: { departmentId: true } },
      },
    });
    if (!user?.role) {
      throw new Error('User not found for import job');
    }
    return {
      id: user.id,
      roleId: user.roleId,
      roleCode: user.role.code,
      departmentId: user.employees?.departmentId ?? null,
    };
  }
}
