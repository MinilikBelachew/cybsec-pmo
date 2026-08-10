import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectTeamService } from '../projects/project-team.service';
import { CaslUserContext } from '../casl/casl.types';
import { ImportsJobsService } from './imports-jobs.service';
import {
  loadExcelWorkbook,
  listExcelSheetNames,
  worksheetToStringGrid,
} from './excel-sheet.reader';
import {
  detectTaskCsvImportKind,
  ExcelTaskPreviewRow,
  processRawTaskRows,
} from './excel-tasks-preview.mapper';
import {
  ParsedMilestonePreviewRow,
  ParsedPhasePreviewRow,
  ParsedProjectPreviewRow,
  processRawMilestoneRows,
  processRawPhaseRows,
  processRawProjectRows,
} from './excel-projects-preview.mapper';
import { ExcelProjectsImportDto } from './dto/excel-projects-import.dto';
import { ImportEnqueueResultDto } from './dto/import-job-status.dto';

export const EXCEL_PROJECTS_PREVIEW_PAGE_SIZE = 50;
const PREVIEW_TTL_SECONDS = 3600;
const PREVIEW_KEY_PREFIX = 'import:preview:projects:';

export type ExcelProjectsPreviewEntity =
  | 'projects'
  | 'phases'
  | 'tasks'
  | 'milestones';

export type ExcelProjectsPreviewStore = {
  previewId: string;
  userId: string;
  createdAt: string;
  fileName: string;
  projects: ParsedProjectPreviewRow[];
  phasesByProject: Record<string, ParsedPhasePreviewRow[]>;
  tasksByProject: Record<string, ExcelTaskPreviewRow[]>;
  milestonesByProject: Record<string, ParsedMilestonePreviewRow[]>;
  nestedCounts: Record<
    string,
    { phases: number; tasks: number; milestones: number }
  >;
  counts: {
    projectsTotal: number;
    projectsValid: number;
    phasesTotal: number;
    tasksTotal: number;
    milestonesTotal: number;
  };
};

@Injectable()
export class ExcelProjectsPreviewService {
  private readonly logger = new Logger(ExcelProjectsPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly projectsService: ProjectsService,
    private readonly projectTeam: ProjectTeamService,
    private readonly importsJobs: ImportsJobsService,
  ) {}

  async preview(
    user: CaslUserContext,
    file: Express.Multer.File,
  ): Promise<{
    previewId: string;
    counts: ExcelProjectsPreviewStore['counts'];
    nestedCounts: ExcelProjectsPreviewStore['nestedCounts'];
    projects: ParsedProjectPreviewRow[];
    projectsTotal: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }> {
    this.assertValidFile(file);
    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    const workbook = await loadExcelWorkbook(file.buffer);
    const sheetNames = listExcelSheetNames(workbook);
    const projectsGrid = worksheetToStringGrid(workbook, 'Projects', {
      allowEmpty: true,
    });
    if (projectsGrid.length <= 1) {
      throw new BadRequestException(
        "The XLSX file must contain a 'Projects' sheet with at least one project row.",
      );
    }

    const kind = detectTaskCsvImportKind(projectsGrid);
    if (kind === 'tasks') {
      throw new BadRequestException(
        'This file looks like a Tasks export. Please upload it in the Project workspace under Import Tasks.',
      );
    }
    if (kind === 'unknown') {
      throw new BadRequestException(
        "The uploaded file does not match the expected Projects format. Please make sure the sheet has headers like 'Name', 'Objective', 'Department', 'Customer', etc.",
      );
    }

    const [departments, customers, managers, existingProjects] =
      await Promise.all([
        this.prisma.department.findMany({
          select: { id: true, name: true, code: true },
        }),
        this.prisma.customer.findMany({
          select: { id: true, displayName: true },
        }),
        this.projectsService.findProjectManagers(),
        this.prisma.project.findMany({ select: { id: true, name: true } }),
      ]);

    let projects = processRawProjectRows(
      projectsGrid,
      departments,
      customers,
      managers,
      existingProjects,
    );

    const existingSet = new Set(
      existingProjects.map((p) => p.name.trim().toLowerCase()),
    );
    projects = projects.map((row) => {
      if (row.importMode === 'update') return row;
      const lowerName = row.name.trim().toLowerCase();
      if (lowerName && existingSet.has(lowerName)) {
        return {
          ...row,
          errors: [...row.errors, `Project "${row.name}" already exists.`],
        };
      }
      return row;
    });

    const phasesByProject: Record<string, ParsedPhasePreviewRow[]> = {};
    const tasksByProject: Record<string, ExcelTaskPreviewRow[]> = {};
    const milestonesByProject: Record<string, ParsedMilestonePreviewRow[]> = {};
    const nestedCounts: ExcelProjectsPreviewStore['nestedCounts'] = {};

    for (const projRow of projects) {
      const projName = projRow.name.trim();
      if (!projName) continue;

      const phaseSheetName = `${projName} Phases`;
      const taskSheetName = `${projName} Tasks`;
      const msSheetName = `${projName} Milestones`;
      const hasPhaseSheet = sheetNames.includes(phaseSheetName);
      const hasTaskSheet = sheetNames.includes(taskSheetName);
      const hasMsSheet = sheetNames.includes(msSheetName);
      if (!hasPhaseSheet && !hasTaskSheet && !hasMsSheet) continue;

      let existingTasks: { id: string; title: string }[] = [];
      let existingPhases: {
        id: string;
        name: string;
        startDate: Date | null;
        endDate: Date | null;
      }[] = [];
      let assignees: {
        userId: string;
        displayName: string;
        email: string;
        name: string;
      }[] = [];
      let existingMilestones: { id: string; title: string }[] = [];

      if (
        projRow.importMode === 'update' &&
        projRow.resolvedProjectId &&
        (hasPhaseSheet || hasTaskSheet || hasMsSheet)
      ) {
        const projectId = projRow.resolvedProjectId;
        const [tasks, phases, team, milestones] = await Promise.all([
          hasTaskSheet
            ? this.prisma.task.findMany({
                where: { projectId },
                select: { id: true, title: true },
              })
            : Promise.resolve([]),
          hasPhaseSheet || hasTaskSheet
            ? this.prisma.projectPhase.findMany({
                where: { projectId },
                orderBy: { orderIndex: 'asc' },
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  endDate: true,
                },
              })
            : Promise.resolve([]),
          hasTaskSheet
            ? this.projectTeam
                .findTaskAssignees(projectId, user)
                .catch(() => [])
            : Promise.resolve([]),
          hasMsSheet
            ? this.prisma.projectMilestone.findMany({
                where: { projectId },
                select: { id: true, title: true },
              })
            : Promise.resolve([]),
        ]);
        existingTasks = tasks;
        existingPhases = phases;
        assignees = team.map((a) => ({
          userId: a.userId,
          displayName: a.displayName,
          email: a.email,
          name: a.name,
        }));
        existingMilestones = milestones;
      }

      if (hasPhaseSheet) {
        const raw = worksheetToStringGrid(workbook, phaseSheetName, {
          allowEmpty: true,
        });
        if (raw.length > 1) {
          phasesByProject[projName] = processRawPhaseRows(
            raw,
            existingPhases.map((p) => ({ id: p.id, name: p.name })),
          );
        }
      }

      if (hasTaskSheet) {
        const raw = worksheetToStringGrid(workbook, taskSheetName, {
          allowEmpty: true,
        });
        if (raw.length > 1) {
          tasksByProject[projName] = processRawTaskRows(
            raw,
            existingPhases,
            assignees,
            existingTasks,
          );
        }
      }

      if (hasMsSheet) {
        const raw = worksheetToStringGrid(workbook, msSheetName, {
          allowEmpty: true,
        });
        if (raw.length > 1) {
          milestonesByProject[projName] = processRawMilestoneRows(
            raw,
            existingMilestones,
          );
        }
      }

      nestedCounts[projName] = {
        phases: phasesByProject[projName]?.length ?? 0,
        tasks: tasksByProject[projName]?.length ?? 0,
        milestones: milestonesByProject[projName]?.length ?? 0,
      };
    }

    const previewId = randomUUID();
    const store: ExcelProjectsPreviewStore = {
      previewId,
      userId: user.id,
      createdAt: new Date().toISOString(),
      fileName: file.originalname || 'projects.xlsx',
      projects,
      phasesByProject,
      tasksByProject,
      milestonesByProject,
      nestedCounts,
      counts: {
        projectsTotal: projects.length,
        projectsValid: projects.filter((p) => p.errors.length === 0).length,
        phasesTotal: Object.values(phasesByProject).reduce(
          (n, rows) => n + rows.length,
          0,
        ),
        tasksTotal: Object.values(tasksByProject).reduce(
          (n, rows) => n + rows.length,
          0,
        ),
        milestonesTotal: Object.values(milestonesByProject).reduce(
          (n, rows) => n + rows.length,
          0,
        ),
      },
    };

    await this.saveStore(store);
    this.logger.log(
      `Excel projects preview ${previewId}: ${store.counts.projectsTotal} projects, ${store.counts.tasksTotal} tasks`,
    );

    const page = this.sliceRows(store.projects, 0, EXCEL_PROJECTS_PREVIEW_PAGE_SIZE);
    return {
      previewId,
      counts: store.counts,
      nestedCounts: store.nestedCounts,
      projects: page.rows,
      projectsTotal: page.total,
      offset: page.offset,
      limit: page.limit,
      hasMore: page.hasMore,
    };
  }

  async getPage(
    userId: string,
    previewId: string,
    entity: ExcelProjectsPreviewEntity,
    offset = 0,
    limit = EXCEL_PROJECTS_PREVIEW_PAGE_SIZE,
    projectName?: string,
  ): Promise<{
    rows: unknown[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }> {
    const store = await this.loadStore(userId, previewId);
    const pageLimit = Math.min(
      Math.max(limit || EXCEL_PROJECTS_PREVIEW_PAGE_SIZE, 1),
      200,
    );
    const pageOffset = Math.max(offset || 0, 0);

    if (entity === 'projects') {
      return this.sliceRows(store.projects, pageOffset, pageLimit);
    }

    if (!projectName?.trim()) {
      throw new BadRequestException(
        'projectName is required for phases, tasks, and milestones pages.',
      );
    }
    const key = projectName.trim();
    if (entity === 'phases') {
      return this.sliceRows(
        store.phasesByProject[key] ?? [],
        pageOffset,
        pageLimit,
      );
    }
    if (entity === 'tasks') {
      return this.sliceRows(
        store.tasksByProject[key] ?? [],
        pageOffset,
        pageLimit,
      );
    }
    return this.sliceRows(
      store.milestonesByProject[key] ?? [],
      pageOffset,
      pageLimit,
    );
  }

  async patchRow(
    userId: string,
    previewId: string,
    body: {
      entity: ExcelProjectsPreviewEntity;
      index: number;
      projectName?: string;
      patch: Record<string, unknown>;
    },
  ): Promise<{ row: unknown }> {
    const store = await this.loadStore(userId, previewId);
    const { entity, index, projectName, patch } = body;
    if (index < 0 || !Number.isFinite(index)) {
      throw new BadRequestException('Invalid row index.');
    }

    if (entity === 'projects') {
      if (index >= store.projects.length) {
        throw new BadRequestException('Project row index out of range.');
      }
      store.projects[index] = {
        ...store.projects[index],
        ...patch,
        errors: Array.isArray(patch.errors)
          ? (patch.errors as string[])
          : store.projects[index].errors,
        warnings: Array.isArray(patch.warnings)
          ? (patch.warnings as string[])
          : store.projects[index].warnings,
      } as ParsedProjectPreviewRow;
      store.counts.projectsValid = store.projects.filter(
        (p) => p.errors.length === 0,
      ).length;
      await this.saveStore(store);
      return { row: store.projects[index] };
    }

    if (!projectName?.trim()) {
      throw new BadRequestException('projectName is required.');
    }
    const key = projectName.trim();
    const list =
      entity === 'phases'
        ? store.phasesByProject[key]
        : entity === 'tasks'
          ? store.tasksByProject[key]
          : store.milestonesByProject[key];
    if (!list || index >= list.length) {
      throw new BadRequestException('Row index out of range.');
    }
    list[index] = {
      ...list[index],
      ...patch,
      errors: Array.isArray(patch.errors)
        ? (patch.errors as string[])
        : list[index].errors,
      warnings: Array.isArray(patch.warnings)
        ? (patch.warnings as string[])
        : list[index].warnings,
    } as (typeof list)[number];
    await this.saveStore(store);
    return { row: list[index] };
  }

  async confirm(
    userId: string,
    previewId: string,
  ): Promise<ImportEnqueueResultDto> {
    const store = await this.loadStore(userId, previewId);
    const validProjects = store.projects.filter((p) => p.errors.length === 0);
    if (validProjects.length === 0) {
      throw new BadRequestException('No valid projects to import.');
    }

    const dto: ExcelProjectsImportDto = {
      projects: validProjects.map((projRow) => ({
        name: projRow.name,
        objective: projRow.objective,
        engagementType: projRow.engagementType,
        billingModel: projRow.billingModel,
        priority: projRow.priority,
        startDate: projRow.startDate,
        endDate: projRow.endDate,
        value: projRow.value,
        currency: projRow.currency,
        status: projRow.status,
        importMode: projRow.importMode,
        resolvedProjectId: projRow.resolvedProjectId,
        resolvedDepartmentId: projRow.resolvedDepartmentId!,
        resolvedCustomerId: projRow.resolvedCustomerId!,
        resolvedPrimaryPmId: projRow.resolvedPrimaryPmId!,
        resolvedSecondaryPmId: projRow.resolvedSecondaryPmId ?? null,
      })),
      phasesByProject: {},
      tasksByProject: {},
      milestonesByProject: {},
    };

    for (const proj of validProjects) {
      const name = proj.name;
      const phaseRows = (store.phasesByProject[name] || []).filter(
        (r) => r.errors.length === 0,
      );
      if (phaseRows.length) {
        dto.phasesByProject![name] = phaseRows.map((row) => ({
          name: row.name,
          description: row.description || undefined,
          orderIndex: row.orderIndex,
          status: row.status,
          startDate: row.startDate || undefined,
          endDate: row.endDate || undefined,
          importMode: row.importMode,
          resolvedPhaseId: row.resolvedPhaseId,
        }));
      }

      const taskRows = (store.tasksByProject[name] || []).filter(
        (r) => r.errors.length === 0,
      );
      if (taskRows.length) {
        dto.tasksByProject![name] = taskRows.map((row) => ({
          title: row.title,
          description: row.description || undefined,
          priority: row.priority,
          status: row.status,
          startDate: row.startDate || undefined,
          endDate: row.endDate || undefined,
          effortHours: row.effortHours || undefined,
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
        }));
      }

      const msRows = (store.milestonesByProject[name] || []).filter(
        (r) => r.errors.length === 0,
      );
      if (msRows.length) {
        dto.milestonesByProject![name] = msRows.map((row) => ({
          title: row.title,
          targetDate: row.targetDate || undefined,
          weight: row.weight,
          status: row.status,
          phaseName: row.phaseName || undefined,
          importMode: row.importMode,
          resolvedMilestoneId: row.resolvedMilestoneId,
        }));
      }
    }

    const result = await this.importsJobs.enqueueExcelProjectsImport(
      userId,
      dto,
    );
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

  private async saveStore(store: ExcelProjectsPreviewStore): Promise<void> {
    await this.redis.set(
      this.key(store.previewId),
      JSON.stringify(store),
      PREVIEW_TTL_SECONDS,
    );
  }

  private async loadStore(
    userId: string,
    previewId: string,
  ): Promise<ExcelProjectsPreviewStore> {
    const raw = await this.redis.get(this.key(previewId));
    if (!raw) {
      throw new NotFoundException(
        'Import preview expired or not found. Please re-upload the file.',
      );
    }
    const store = JSON.parse(raw) as ExcelProjectsPreviewStore;
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
}
