import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord } from '../utils/failed-sync-record.util';
import { KekaPsaProject, KekaPsaTask } from '../keka.types';

export type ProjectLinkResult = {
  synced: number;
  failed: number;
};

type StringResponse = {
  succeeded?: boolean;
  data?: string | null;
  message?: string | null;
};

type BooleanResponse = {
  succeeded?: boolean;
  data?: boolean;
  message?: string | null;
  errors?: string[] | null;
};

@Injectable()
export class ProjectLinkService {
  private readonly logger = new Logger(ProjectLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  /**
   * Match local projects/tasks to existing Keka PSA projects by id/code/name.
   * Does not create Keka projects (requires clientId); use ensureProjectLinked for create.
   */
  async linkProjectsAndTasks(): Promise<ProjectLinkResult> {
    const kekaProjects = await this.kekaClient.getAllPages<KekaPsaProject>(
      '/psa/projects',
    );
    const localProjects = await this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        kekaProjectId: true,
        kekaProjectCode: true,
        tasks: { select: { id: true, title: true, kekaTaskId: true } },
      },
    });

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;

    const byId = new Map(
      kekaProjects
        .filter((project) => project.id?.trim())
        .map((project) => [project.id!.trim(), project]),
    );
    const byCode = new Map(
      kekaProjects
        .filter((project) => project.code?.trim())
        .map((project) => [project.code!.trim().toLowerCase(), project]),
    );
    const byName = new Map(
      kekaProjects
        .filter((project) => project.name?.trim())
        .map((project) => [project.name!.trim().toLowerCase(), project]),
    );

    for (const local of localProjects) {
      try {
        let matched: KekaPsaProject | undefined;

        if (local.kekaProjectId) {
          matched = byId.get(local.kekaProjectId);
        }
        if (!matched && local.kekaProjectCode) {
          matched = byCode.get(local.kekaProjectCode.toLowerCase());
        }
        if (!matched) {
          matched = byName.get(local.name.trim().toLowerCase());
        }

        if (!matched?.id) {
          continue;
        }

        await this.prisma.project.update({
          where: { id: local.id },
          data: {
            kekaProjectId: matched.id.trim(),
            kekaClientId: matched.clientId?.trim() || null,
            kekaProjectCode: matched.code?.trim() || local.kekaProjectCode,
            kekaSyncedAt: syncedAt,
          },
        });

        await this.logSuccess(KEKA_ENTITY_TYPE.PROJECT, local.id, matched);
        synced += 1;

        const taskResult = await this.linkTasksForProject(
          local.id,
          matched.id.trim(),
          local.tasks,
          syncedAt,
        );
        synced += taskResult.synced;
        failed += taskResult.failed;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown project link error';
        this.logger.warn(`Project link failed for ${local.id}: ${message}`);
        await this.logFailure(KEKA_ENTITY_TYPE.PROJECT, local.id, local, message);
      }
    }

    return { synced, failed };
  }

  /**
   * Ensure a local project has a Keka PSA id. Matches first; creates only when kekaClientId is set.
   */
  async ensureProjectLinked(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        objective: true,
        startDate: true,
        endDate: true,
        kekaProjectId: true,
        kekaClientId: true,
        kekaProjectCode: true,
        customer: {
          select: { kekaClientId: true, kekaClientCode: true, displayName: true },
        },
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (project.kekaProjectId?.trim()) {
      return project.kekaProjectId.trim();
    }

    await this.linkProjectsAndTasks();

    const refreshed = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        kekaProjectId: true,
        kekaClientId: true,
        kekaProjectCode: true,
        customer: { select: { kekaClientId: true } },
      },
    });

    if (refreshed?.kekaProjectId?.trim()) {
      return refreshed.kekaProjectId.trim();
    }

    const clientId =
      refreshed?.kekaClientId?.trim() ||
      project.kekaClientId?.trim() ||
      refreshed?.customer?.kekaClientId?.trim() ||
      project.customer?.kekaClientId?.trim();
    if (!clientId) {
      throw new Error(
        `Project "${project.name}" has no Keka project match and no kekaClientId to create one` +
          (project.customer?.displayName
            ? ` (customer "${project.customer.displayName}" is not linked to a Keka client)`
            : ''),
      );
    }

    const code =
      refreshed?.kekaProjectCode?.trim() ||
      project.kekaProjectCode?.trim() ||
      this.buildProjectCode(project.name, project.id);

    const response = await this.kekaClient.post<StringResponse>('/psa/projects', {
      clientId,
      name: project.name,
      description: project.objective,
      code,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate.toISOString(),
      isBillable: true,
      status: 1,
    });

    const kekaProjectId = response.data?.trim();
    if (!kekaProjectId) {
      throw new Error(
        response.message ?? `Keka did not return a project id for ${project.name}`,
      );
    }

    const syncedAt = new Date();
    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        kekaProjectId,
        kekaClientId: clientId,
        kekaProjectCode: code,
        kekaSyncedAt: syncedAt,
      },
    });

    await this.logSuccess(KEKA_ENTITY_TYPE.PROJECT, project.id, {
      kekaProjectId,
      clientId,
      code,
    });

    return kekaProjectId;
  }

  async ensureTaskLinked(taskId: string): Promise<string | null> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { kekaTaskId: true },
    });
    if (existing?.kekaTaskId?.trim()) {
      return existing.kekaTaskId.trim();
    }
    return this.syncTaskToKeka(taskId);
  }

  /**
   * Create or update the task in Keka PSA under the linked project.
   * Soft-skips when the project is not linked / cannot be linked.
   * Includes assignedTo (owner + backup) when those users have Keka employee IDs.
   */
  async syncTaskToKeka(taskId: string): Promise<string | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        effortHours: true,
        kekaTaskId: true,
        projectId: true,
        ownerId: true,
        backupOwnerId: true,
        project: {
          select: { kekaProjectId: true, name: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let kekaProjectId = task.project.kekaProjectId?.trim() || null;
    if (!kekaProjectId) {
      try {
        kekaProjectId = await this.ensureProjectLinked(task.projectId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'project link failed';
        this.logger.warn(
          `Skip Keka task sync for "${task.title}": project not linked (${message})`,
        );
        await this.logFailure(KEKA_ENTITY_TYPE.TASK, task.id, { taskId }, message);
        return null;
      }
    }

    const payload = {
      projectId: kekaProjectId,
      name: task.title.trim(),
      description: task.description,
      taskBillingType: 1,
      startDate: (task.startDate ?? new Date()).toISOString(),
      endDate: (task.endDate ?? task.startDate ?? new Date()).toISOString(),
      estimatedHours:
        task.effortHours != null ? Number(task.effortHours) : null,
    };

    try {
      if (!task.kekaTaskId?.trim()) {
        await this.linkTasksForProject(
          task.projectId,
          kekaProjectId,
          [{ id: task.id, title: task.title, kekaTaskId: task.kekaTaskId }],
          new Date(),
        );
        const afterLink = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { kekaTaskId: true },
        });
        if (afterLink?.kekaTaskId?.trim()) {
          await this.updateKekaTask(
            kekaProjectId,
            afterLink.kekaTaskId.trim(),
            task,
          );
          return afterLink.kekaTaskId.trim();
        }
      }

      if (task.kekaTaskId?.trim()) {
        await this.updateKekaTask(kekaProjectId, task.kekaTaskId.trim(), task);
        return task.kekaTaskId.trim();
      }

      const assignedTo = await this.resolveAssigneeKekaIds(
        task.ownerId,
        task.backupOwnerId,
      );
      const createBody = {
        ...payload,
        assignedTo: assignedTo.length ? assignedTo : null,
      };

      const response = await this.kekaClient.post<StringResponse>(
        `/psa/projects/${encodeURIComponent(kekaProjectId)}/tasks`,
        createBody,
      );

      if (response.succeeded === false) {
        throw new Error(
          response.message?.trim() ||
            `Keka rejected task create for "${task.title}"`,
        );
      }

      const kekaTaskId = response.data?.trim();
      if (!kekaTaskId) {
        throw new Error(
          response.message?.trim() ||
            `Keka did not return a task id for "${task.title}" on project ${kekaProjectId}`,
        );
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: { kekaTaskId, kekaSyncedAt: new Date() },
      });
      await this.logSuccess(KEKA_ENTITY_TYPE.TASK, task.id, {
        kekaTaskId,
        assignedTo,
      });
      return kekaTaskId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Keka task sync failed';
      this.logger.error(`Keka task sync failed for ${taskId}: ${message}`);
      await this.logFailure(KEKA_ENTITY_TYPE.TASK, task.id, payload, message);
      return null;
    }
  }

  private async updateKekaTask(
    kekaProjectId: string,
    kekaTaskId: string,
    task: {
      id: string;
      title: string;
      description: string | null;
      startDate: Date | null;
      endDate: Date | null;
      effortHours: number | null;
      ownerId: string | null;
      backupOwnerId: string | null;
    },
  ): Promise<void> {
    const assignedTo = await this.resolveAssigneeKekaIds(
      task.ownerId,
      task.backupOwnerId,
    );
    const body = {
      name: task.title.trim(),
      description: task.description,
      taskBillingType: 1,
      assignedTo: assignedTo.length ? assignedTo : null,
      startDate: (task.startDate ?? new Date()).toISOString(),
      endDate: (task.endDate ?? task.startDate ?? new Date()).toISOString(),
      estimatedHours:
        task.effortHours != null ? Number(task.effortHours) : null,
    };

    const response = await this.kekaClient.put<BooleanResponse>(
      `/psa/projects/${encodeURIComponent(kekaProjectId)}/tasks/${encodeURIComponent(kekaTaskId)}`,
      body,
    );

    if (response.succeeded === false) {
      throw new Error(
        response.message?.trim() ||
          `Keka rejected task update for "${task.title}"`,
      );
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: { kekaSyncedAt: new Date() },
    });
    await this.logSuccess(KEKA_ENTITY_TYPE.TASK, task.id, {
      kekaTaskId,
      assignedTo,
      updated: true,
    });
  }

  private async resolveAssigneeKekaIds(
    ownerId: string | null,
    backupOwnerId: string | null,
  ): Promise<string[]> {
    const userIds = [ownerId, backupOwnerId].filter(
      (id): id is string => Boolean(id),
    );
    if (userIds.length === 0) {
      return [];
    }

    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: userIds } },
      select: { kekaEmployeeId: true },
    });

    return [
      ...new Set(
        employees
          .map((row) => row.kekaEmployeeId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private async linkTasksForProject(
    projectId: string,
    kekaProjectId: string,
    localTasks: Array<{ id: string; title: string; kekaTaskId: string | null }>,
    syncedAt: Date,
  ): Promise<ProjectLinkResult> {
    let synced = 0;
    let failed = 0;

    const kekaTasks = await this.kekaClient.getAllPages<KekaPsaTask>(
      `/psa/projects/${encodeURIComponent(kekaProjectId)}/tasks`,
    );

    const byId = new Map(
      kekaTasks
        .filter((task) => task.id?.trim())
        .map((task) => [task.id!.trim(), task]),
    );
    const byName = new Map(
      kekaTasks
        .filter((task) => task.name?.trim())
        .map((task) => [task.name!.trim().toLowerCase(), task]),
    );

    for (const local of localTasks) {
      try {
        let matched: KekaPsaTask | undefined;
        if (local.kekaTaskId) {
          matched = byId.get(local.kekaTaskId);
        }
        if (!matched) {
          matched = byName.get(local.title.trim().toLowerCase());
        }
        if (!matched?.id) {
          continue;
        }

        await this.prisma.task.update({
          where: { id: local.id },
          data: {
            kekaTaskId: matched.id.trim(),
            kekaSyncedAt: syncedAt,
          },
        });
        await this.logSuccess(KEKA_ENTITY_TYPE.TASK, local.id, matched);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown task link error';
        this.logger.warn(`Task link failed for ${local.id}: ${message}`);
        await this.logFailure(KEKA_ENTITY_TYPE.TASK, local.id, local, message);
      }
    }

    return { synced, failed };
  }

  private buildProjectCode(name: string, id: string): string {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
    return `${base || 'PRJ'}-${id.slice(0, 8)}`;
  }

  private async logSuccess(
    entityType: string,
    entityId: string,
    payload: unknown,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async logFailure(
    entityType: string,
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: entityType,
      entityId: entityId,
      direction: KEKA_SYNC_DIRECTION.OUTBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });

  }
}
