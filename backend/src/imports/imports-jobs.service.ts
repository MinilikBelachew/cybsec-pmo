import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, JobOptions, Queue } from 'bull';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { CreateMppPortfolioImportDto } from '../mpp-import/dto/create-mpp-portfolio-import.dto';
import {
  EXCEL_PROJECTS_IMPORT_JOB,
  EXCEL_TASKS_IMPORT_JOB,
  IMPORT_CLIENT_QUEUE_KEY_PREFIX,
  IMPORT_CLIENT_QUEUE_TTL_SECONDS,
  IMPORT_LOCK_KEY_PREFIX,
  IMPORT_LOCK_TTL_SECONDS,
  IMPORT_MAX_PER_USER,
  IMPORT_QUEUE_FULL,
  IMPORT_QUEUE_KEY_PREFIX,
  IMPORTS_QUEUE,
  MPP_IMPORT_JOB,
  MPP_PORTFOLIO_IMPORT_JOB,
} from './imports.constants';
import {
  ActiveImportJobDto,
  ImportEnqueueResultDto,
  ImportJobStatusDto,
  QueuedImportStatusDto,
} from './dto/import-job-status.dto';
import {
  ExcelProjectsImportJobData,
  ExcelTasksImportJobData,
  ImportJobData,
  MppImportJobData,
  MppPortfolioImportJobData,
} from './imports.types';
import { ExcelProjectsImportDto } from './dto/excel-projects-import.dto';
import { ExcelTasksImportDto } from './dto/excel-tasks-import.dto';

const IMPORT_JOB_OPTIONS: JobOptions = {
  attempts: 1,
  removeOnComplete: 50,
  removeOnFail: 50,
};

type PendingImportEntry = {
  queueId: string;
  jobName: string;
  data: ImportJobData;
  enqueuedAt: string;
};

type ClientQueueRecord = {
  status: 'queued' | 'started';
  jobId: string | null;
  userId: string;
  position?: number;
};

@Injectable()
export class ImportsJobsService {
  private readonly logger = new Logger(ImportsJobsService.name);

  constructor(
    @InjectQueue(IMPORTS_QUEUE) private readonly importsQueue: Queue,
    private readonly redis: RedisService,
  ) {}

  async enqueueMppImport(input: {
    userId: string;
    projectId: string;
    fileName: string;
    filePath: string;
  }): Promise<ImportEnqueueResultDto> {
    const data: MppImportJobData = {
      kind: 'mpp',
      userId: input.userId,
      projectId: input.projectId,
      fileName: input.fileName,
      filePath: input.filePath,
    };
    return this.enqueue(MPP_IMPORT_JOB, data);
  }

  async enqueueMppPortfolioImport(input: {
    userId: string;
    fileName: string;
    filePath: string;
    portfolioDto: CreateMppPortfolioImportDto;
  }): Promise<ImportEnqueueResultDto> {
    const data: MppPortfolioImportJobData = {
      kind: 'mpp-portfolio',
      userId: input.userId,
      fileName: input.fileName,
      filePath: input.filePath,
      portfolioDto: input.portfolioDto,
    };
    return this.enqueue(MPP_PORTFOLIO_IMPORT_JOB, data);
  }

  async enqueueExcelTasksImport(
    userId: string,
    dto: ExcelTasksImportDto,
  ): Promise<ImportEnqueueResultDto> {
    const data: ExcelTasksImportJobData = {
      kind: 'excel-tasks',
      userId,
      projectId: dto.projectId,
      rows: dto.rows,
    };
    return this.enqueue(EXCEL_TASKS_IMPORT_JOB, data);
  }

  async enqueueExcelProjectsImport(
    userId: string,
    dto: ExcelProjectsImportDto,
  ): Promise<ImportEnqueueResultDto> {
    const data: ExcelProjectsImportJobData = {
      kind: 'excel-projects',
      userId,
      projects: dto.projects,
      phasesByProject: dto.phasesByProject ?? {},
      tasksByProject: dto.tasksByProject ?? {},
      milestonesByProject: dto.milestonesByProject ?? {},
    };
    return this.enqueue(EXCEL_PROJECTS_IMPORT_JOB, data);
  }

  async getJobStatus(
    jobId: string,
    userId: string,
  ): Promise<ImportJobStatusDto> {
    const job = await this.importsQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const data = job.data as ImportJobData;
    if (data.userId !== userId) {
      throw new ForbiddenException('Import job not accessible');
    }

    const state = await job.getState();
    const { progress, step } = this.parseProgress(job.progress());

    return {
      jobId: String(job.id),
      status: this.mapJobState(state),
      progress,
      step,
      kind: data.kind ?? null,
      result:
        state === 'completed' && job.returnvalue
          ? (job.returnvalue as Record<string, unknown>)
          : null,
      failedReason: state === 'failed' ? job.failedReason ?? null : null,
    };
  }

  async getActiveImport(userId: string): Promise<ActiveImportJobDto> {
    const queuedCount = await this.pendingCount(userId);
    const active = await this.findActiveJobForUser(userId);
    if (!active) {
      return {
        jobId: null,
        kind: null,
        status: null,
        progress: 0,
        step: null,
        queuedCount,
        maxPerUser: IMPORT_MAX_PER_USER,
      };
    }

    const state = await active.getState();
    const { progress, step } = this.parseProgress(active.progress());
    const data = active.data as ImportJobData;

    return {
      jobId: String(active.id),
      kind: data.kind ?? null,
      status: state as 'waiting' | 'active' | 'delayed' | 'paused',
      progress,
      step,
      queuedCount,
      maxPerUser: IMPORT_MAX_PER_USER,
    };
  }

  async getQueuedImportStatus(
    queueId: string,
    userId: string,
  ): Promise<QueuedImportStatusDto> {
    const raw = await this.redis.get(this.clientQueueKey(queueId));
    if (!raw) {
      return { status: 'unknown', jobId: null };
    }
    let record: ClientQueueRecord;
    try {
      record = JSON.parse(raw) as ClientQueueRecord;
    } catch {
      return { status: 'unknown', jobId: null };
    }
    if (record.userId !== userId) {
      throw new ForbiddenException('Queued import not accessible');
    }
    const pendingCount = await this.pendingCount(userId);
    return {
      status: record.status,
      jobId: record.jobId,
      position: record.position,
      pendingCount,
      maxPerUser: IMPORT_MAX_PER_USER,
    };
  }

  async releaseUserLock(userId: string): Promise<void> {
    await this.redis.del(`${IMPORT_LOCK_KEY_PREFIX}${userId}`);
  }

  /**
   * Release the per-user lock, then start the next FIFO pending import if any.
   */
  async releaseUserLockAndStartNext(userId: string): Promise<void> {
    await this.releaseUserLock(userId);

    const pendingKey = this.pendingKey(userId);
    const raw = await this.redis.lpop(pendingKey);
    if (!raw) return;

    let entry: PendingImportEntry;
    try {
      entry = JSON.parse(raw) as PendingImportEntry;
    } catch {
      this.logger.warn(
        `Invalid pending import payload for user ${userId}; discarding`,
      );
      await this.releaseUserLockAndStartNext(userId);
      return;
    }

    const lockKey = `${IMPORT_LOCK_KEY_PREFIX}${userId}`;
    const locked = await this.redis.setNx(
      lockKey,
      '1',
      IMPORT_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      await this.redis.lpush(pendingKey, raw);
      return;
    }

    try {
      const job = await this.importsQueue.add(
        entry.jobName,
        entry.data,
        IMPORT_JOB_OPTIONS,
      );
      const jobId = String(job.id ?? 'unknown');
      await this.saveClientQueueRecord(entry.queueId, {
        status: 'started',
        jobId,
        userId,
      });
      this.logger.log(
        `Started queued import ${entry.jobName} for user ${userId} (queueId=${entry.queueId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to start queued import for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.redis.del(lockKey);
      await this.redis.lpush(pendingKey, raw);
    }
  }

  private async enqueue(
    name: string,
    data: ImportJobData,
  ): Promise<ImportEnqueueResultDto> {
    const existing = await this.findActiveJobForUser(data.userId);
    const pending = await this.pendingCount(data.userId);
    const occupied = (existing ? 1 : 0) + pending;

    if (occupied >= IMPORT_MAX_PER_USER) {
      throw new ConflictException({
        statusCode: 409,
        code: IMPORT_QUEUE_FULL,
        message: `Import queue is full (max ${IMPORT_MAX_PER_USER}). Wait for one to finish.`,
        pendingCount: pending,
        maxPerUser: IMPORT_MAX_PER_USER,
        jobId: existing ? String(existing.id) : null,
      });
    }

    if (!existing) {
      const started = await this.tryStartNow(name, data);
      if (started) return started;

      const again = await this.findActiveJobForUser(data.userId);
      const pendingNow = await this.pendingCount(data.userId);
      if ((again ? 1 : 0) + pendingNow >= IMPORT_MAX_PER_USER) {
        throw new ConflictException({
          statusCode: 409,
          code: IMPORT_QUEUE_FULL,
          message: `Import queue is full (max ${IMPORT_MAX_PER_USER}). Wait for one to finish.`,
          pendingCount: pendingNow,
          maxPerUser: IMPORT_MAX_PER_USER,
          jobId: again ? String(again.id) : null,
        });
      }
      return this.pushPending(name, data, again);
    }

    return this.pushPending(name, data, existing);
  }

  private async tryStartNow(
    name: string,
    data: ImportJobData,
  ): Promise<ImportEnqueueResultDto | null> {
    const lockKey = `${IMPORT_LOCK_KEY_PREFIX}${data.userId}`;
    const locked = await this.redis.setNx(
      lockKey,
      '1',
      IMPORT_LOCK_TTL_SECONDS,
    );
    if (!locked) return null;

    try {
      const job = await this.importsQueue.add(name, data, IMPORT_JOB_OPTIONS);
      const pendingCount = await this.pendingCount(data.userId);
      return {
        status: 'started',
        jobId: String(job.id ?? 'unknown'),
        pendingCount,
        totalCount: 1 + pendingCount,
        maxPerUser: IMPORT_MAX_PER_USER,
      };
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  private async pushPending(
    name: string,
    data: ImportJobData,
    active: Job<ImportJobData> | null,
  ): Promise<ImportEnqueueResultDto> {
    const queueId = randomUUID();
    const entry: PendingImportEntry = {
      queueId,
      jobName: name,
      data,
      enqueuedAt: new Date().toISOString(),
    };
    const pendingKey = this.pendingKey(data.userId);
    const pendingCount = await this.redis.rpush(
      pendingKey,
      JSON.stringify(entry),
    );
    await this.saveClientQueueRecord(queueId, {
      status: 'queued',
      jobId: null,
      userId: data.userId,
      position: pendingCount,
    });
    return {
      status: 'queued',
      jobId: null,
      queueId,
      position: pendingCount,
      pendingCount,
      totalCount: (active ? 1 : 0) + pendingCount,
      maxPerUser: IMPORT_MAX_PER_USER,
      activeJobId: active ? String(active.id) : null,
    };
  }

  private async saveClientQueueRecord(
    queueId: string,
    record: ClientQueueRecord,
  ): Promise<void> {
    await this.redis.set(
      this.clientQueueKey(queueId),
      JSON.stringify(record),
      IMPORT_CLIENT_QUEUE_TTL_SECONDS,
    );
  }

  private clientQueueKey(queueId: string): string {
    return `${IMPORT_CLIENT_QUEUE_KEY_PREFIX}${queueId}`;
  }

  private pendingKey(userId: string): string {
    return `${IMPORT_QUEUE_KEY_PREFIX}${userId}`;
  }

  private async pendingCount(userId: string): Promise<number> {
    return this.redis.llen(this.pendingKey(userId));
  }

  private async findActiveJobForUser(
    userId: string,
  ): Promise<Job<ImportJobData> | null> {
    const jobs = await this.importsQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);
    for (const job of jobs) {
      if ((job.data as ImportJobData)?.userId === userId) {
        return job as Job<ImportJobData>;
      }
    }
    return null;
  }

  private mapJobState(
    state: string,
  ): ImportJobStatusDto['status'] {
    switch (state) {
      case 'waiting':
      case 'active':
      case 'completed':
      case 'failed':
      case 'delayed':
      case 'paused':
        return state;
      default:
        return 'unknown';
    }
  }

  private parseProgress(raw: unknown): { progress: number; step: string | null } {
    if (typeof raw === 'number') {
      return { progress: Math.max(0, Math.min(100, Math.round(raw))), step: null };
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as { percent?: unknown; step?: unknown };
      const percent =
        typeof obj.percent === 'number'
          ? Math.max(0, Math.min(100, Math.round(obj.percent)))
          : 0;
      const step = typeof obj.step === 'string' ? obj.step : null;
      return { progress: percent, step };
    }
    return { progress: 0, step: null };
  }
}
