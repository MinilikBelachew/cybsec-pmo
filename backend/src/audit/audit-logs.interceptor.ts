import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../database/prisma.service';
import { resolveStatusChangeAction } from './status-change-audit.util';
import { generateAuditDescription } from './audit-description.helper';
import { formatIpWithUserAgent } from '../auth/utils/request-context.util';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshToken',
  'clientSecret',
  'secret',
  'accessToken',
  'idToken',
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AuditRouteTarget = {
  objectType: string;
  action: string;
  /** ID used to fetch oldValue before PATCH/DELETE */
  resourceId: string | null;
};

@Injectable()
export class AuditLogsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogsInterceptor.name);

  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url as string;

    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }

    if (
      url.includes('/auth/break-glass') ||
      url.includes('/auth/emergency-login')
    ) {
      return next.handle();
    }

    const urlParts = this.parseUrlParts(url);
    const auditTarget = this.resolveRouteAudit(urlParts, method, url);

    const actorId = request.user?.id || null;
    const rawIp =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.socket.remoteAddress ||
      null;
    const userAgent = request.headers['user-agent'] || null;
    const ipAddress = formatIpWithUserAgent(rawIp, userAgent);
    const isExternal = request.user?.isExternal || false;
    const isBreakGlass = request.user?.breakGlass === true;
    const bodyPayload = this.maskSensitiveFields(request.body);

    return new Observable((observer) => {
      this.getOldValue(auditTarget.objectType, auditTarget.resourceId)
        .then((oldValue) => {
          next.handle().subscribe({
            next: (response) => {
              observer.next(response);

              void (async () => {
                try {
                  let finalObjectId = auditTarget.resourceId;
                  let newValue: unknown = bodyPayload;

                  if (response && typeof response === 'object') {
                    const extracted = this.extractResponsePayload(
                      response,
                      method,
                    );
                    if (extracted.objectId) {
                      finalObjectId = extracted.objectId;
                    }
                    if (extracted.newValue !== undefined) {
                      newValue = extracted.newValue;
                    }
                  }

                  // Soft-remove team member: DELETE returns void but status becomes Removed
                  if (
                    method === 'DELETE' &&
                    auditTarget.objectType === 'Allocation' &&
                    oldValue &&
                    typeof oldValue === 'object'
                  ) {
                    newValue = {
                      ...(oldValue as Record<string, unknown>),
                      status: 'Removed',
                    };
                  }

                  let auditAction = auditTarget.action;
                  // Soft deletes / nested creates must keep their CRUD action —
                  // only real UPDATE/PATCH status transitions get rewritten.
                  const statusChange =
                    method === 'PATCH' || method === 'PUT'
                      ? resolveStatusChangeAction(
                          auditTarget.objectType,
                          oldValue,
                          newValue,
                        )
                      : null;
                  if (statusChange) {
                    auditAction = statusChange.action;
                    newValue = statusChange.newValue;
                  }

                  if (isBreakGlass) {
                    newValue =
                      newValue && typeof newValue === 'object'
                        ? { ...(newValue as object), breakGlassAction: true }
                        : { breakGlassAction: true };
                  }

                  const enrichedOld = await this.enrichNames(
                    auditTarget.objectType,
                    oldValue,
                  );
                  const enrichedNew = await this.enrichNames(
                    auditTarget.objectType,
                    newValue,
                  );

                  const safeOldValue = this.toJsonSafe(enrichedOld);
                  const safeNewValue = this.toJsonSafe(enrichedNew);
                  const description = generateAuditDescription({
                    action: auditAction,
                    objectType: auditTarget.objectType,
                    objectId: finalObjectId,
                    oldValue: safeOldValue,
                    newValue: safeNewValue,
                  });

                  this.auditLogsService
                    .create({
                      action: auditAction,
                      objectType: auditTarget.objectType,
                      objectId: finalObjectId,
                      description,
                      oldValue: safeOldValue ?? Prisma.DbNull,
                      newValue: safeNewValue ?? Prisma.DbNull,
                      ipAddress,
                      isExternal,
                      breakGlassAction: isBreakGlass,
                      source: 'WebAPI',
                      user: actorId ? { connect: { id: actorId } } : undefined,
                    })
                    .catch((err) => {
                      this.logger.error('Failed to save audit log to DB:', err);
                    });

                  console.log(
                    JSON.stringify({
                      timestamp: new Date().toISOString(),
                      level: 'AUDIT',
                      actorId,
                      action: auditAction,
                      objectType: auditTarget.objectType,
                      objectId: finalObjectId,
                      description,
                      oldValue: safeOldValue,
                      newValue: safeNewValue,
                      ipAddress,
                      isExternal,
                    }),
                  );
                } catch (err) {
                  // Never let audit serialization crash the request / process
                  // (e.g. Prisma BigInt sizeBytes on TaskAttachment delete).
                  this.logger.error('Failed to write audit log:', err);
                }
              })();
            },
            error: (err) => {
              observer.error(err);
            },
            complete: () => {
              observer.complete();
            },
          });
        })
        .catch((err) => {
          this.logger.error('Error pre-fetching oldValue for audit:', err);
          next.handle().subscribe(observer);
        });
    });
  }

  /**
   * Prefer entity payloads over wrapper DTOs so before/after show the real
   * ActionPoint / Allocation rather than a project envelope.
   */
  private extractResponsePayload(
    response: Record<string, any>,
    method: string,
  ): { objectId: string | null; newValue: unknown | undefined } {
    if (Array.isArray(response.created) && response.created.length > 0) {
      const created = response.created.map((row: unknown) =>
        this.maskSensitiveFields(row),
      );
      const firstId =
        created[0] &&
        typeof created[0] === 'object' &&
        typeof (created[0] as { id?: unknown }).id === 'string' &&
        UUID_REGEX.test((created[0] as { id: string }).id)
          ? (created[0] as { id: string }).id
          : null;
      return {
        objectId: firstId,
        newValue: created.length === 1 ? created[0] : created,
      };
    }

    if (response.updated && typeof response.updated === 'object') {
      const updated = this.maskSensitiveFields(response.updated);
      const id =
        typeof updated.id === 'string' && UUID_REGEX.test(updated.id)
          ? updated.id
          : null;
      return { objectId: id, newValue: updated };
    }

    let objectId: string | null = null;
    if (response.id && UUID_REGEX.test(response.id)) {
      objectId = response.id;
    }

    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      return {
        objectId,
        newValue: this.maskSensitiveFields(response),
      };
    }

    return { objectId, newValue: undefined };
  }

  private parseUrlParts(url: string): string[] {
    const path = url.split('?')[0];
    return path.replace(/^\/api\/v\d+\//, '').split('/').filter(Boolean);
  }

  private resolveRouteAudit(
    urlParts: string[],
    method: string,
    url: string,
  ): AuditRouteTarget {
    const root = (urlParts[0] ?? 'system').toLowerCase();

    if (root === 'auth') {
      if (url.includes('/entra/login') || url.includes('/login')) {
        return { objectType: 'Auth', action: 'LOGIN', resourceId: null };
      }
      if (url.includes('/logout')) {
        return { objectType: 'Auth', action: 'LOGOUT', resourceId: null };
      }
      if (url.includes('/refresh')) {
        return { objectType: 'Session', action: 'REFRESH', resourceId: null };
      }
      return { objectType: 'Auth', action: method, resourceId: null };
    }

    if (root === 'files' && urlParts.includes('upload')) {
      return { objectType: 'File', action: 'CREATE_UPLOAD', resourceId: null };
    }

    if (root === 'tasks' && urlParts[1] === 'dependencies') {
      const dependencyId =
        urlParts[2] && UUID_REGEX.test(urlParts[2]) ? urlParts[2] : null;
      return {
        objectType: 'TaskDependency',
        action:
          method === 'POST'
            ? 'CREATE_DEPENDENCY'
            : method === 'DELETE'
              ? 'DELETE_DEPENDENCY'
              : this.defaultCrudAction(method),
        resourceId: dependencyId,
      };
    }

    if (root === 'projects' && urlParts[1] === 'meta') {
      return {
        objectType: 'Project',
        action: this.defaultCrudAction(method),
        resourceId: null,
      };
    }

    const firstUuidIndex = urlParts.findIndex((part) => UUID_REGEX.test(part));
    const firstUuid = firstUuidIndex >= 0 ? urlParts[firstUuidIndex] : null;
    const segmentsAfterUuid =
      firstUuidIndex >= 0 ? urlParts.slice(firstUuidIndex + 1) : [];

    if (segmentsAfterUuid.length > 0) {
      const nested = this.resolveNestedResource(
        root,
        segmentsAfterUuid,
        method,
      );
      if (nested) {
        return nested;
      }
    }

    return {
      objectType: this.mapRootToEntity(root),
      action: this.mapRootAction(method, root),
      resourceId: firstUuid,
    };
  }

  private resolveNestedResource(
    root: string,
    segmentsAfterUuid: string[],
    method: string,
  ): AuditRouteTarget | null {
    const sub = segmentsAfterUuid[0].toLowerCase();
    const nestedUuid =
      segmentsAfterUuid.find((part) => UUID_REGEX.test(part)) ?? null;
    const hasReview = segmentsAfterUuid.includes('review');
    const hasBackup = segmentsAfterUuid.includes('backup');

    const subEntityByRoot: Record<string, Record<string, string>> = {
      tasks: {
        comments: 'TaskComment',
        attachments: 'WorkspaceDocument',
        'progress-updates': 'TaskProgressUpdate',
      },
      projects: {
        milestones: 'ProjectMilestone',
        documents: 'WorkspaceDocument',
        team: 'Allocation',
        'action-points': 'ActionPoint',
        phases: 'ProjectPhase',
      },
    };

    const objectType = subEntityByRoot[root]?.[sub];
    if (!objectType) {
      return null;
    }

    let action: string;
    if (sub === 'progress-updates' && hasReview && method === 'PATCH') {
      action = 'REVIEW_PROGRESS';
    } else if (sub === 'team' && hasBackup && method === 'PATCH') {
      action = 'SET_ALLOCATION_BACKUP';
    } else if (sub === 'attachments' && method === 'POST') {
      // Preserve legacy audit action for task files after WorkspaceDocument migration.
      action = 'CREATE_TASK_ATTACHMENT';
    } else if (sub === 'attachments' && method === 'DELETE') {
      action = 'DELETE_TASK_ATTACHMENT';
    } else if (method === 'POST') {
      action = `CREATE_${this.toActionToken(objectType)}`;
    } else if (method === 'PATCH' || method === 'PUT') {
      action = `UPDATE_${this.toActionToken(objectType)}`;
    } else if (method === 'DELETE') {
      action = `DELETE_${this.toActionToken(objectType)}`;
    } else {
      action = this.defaultCrudAction(method);
    }

    return {
      objectType,
      action,
      resourceId: method === 'POST' ? null : nestedUuid,
    };
  }

  private toActionToken(objectType: string): string {
    return objectType.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  }

  private mapRootToEntity(root: string): string {
    switch (root) {
      case 'projects':
        return 'Project';
      case 'tasks':
        return 'Task';
      case 'users':
        return 'User';
      case 'departments':
        return 'Department';
      case 'files':
        return 'File';
      case 'audit-logs':
        return 'AuditLog';
      default:
        return root.charAt(0).toUpperCase() + root.slice(1);
    }
  }

  private mapRootAction(method: string, root: string): string {
    const entity = this.toActionToken(this.mapRootToEntity(root));
    if (method === 'POST') return `CREATE_${entity}`;
    if (method === 'PATCH' || method === 'PUT') return `UPDATE_${entity}`;
    if (method === 'DELETE') return `DELETE_${entity}`;
    return method;
  }

  private defaultCrudAction(method: string): string {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PATCH':
      case 'PUT':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  private async getOldValue(
    entity: string,
    objectId: string | null,
  ): Promise<any | null> {
    if (!objectId) return null;

    const prismaModelName = this.toPrismaModelName(entity);
    if (!prismaModelName) return null;

    try {
      if (prismaModelName in this.prisma) {
        const record = await (this.prisma as any)[prismaModelName].findUnique({
          where: { id: objectId },
          include: this.auditIncludeFor(entity),
        });
        return record
          ? this.maskSensitiveFields(await this.enrichNames(entity, record))
          : null;
      }
    } catch (e) {
      this.logger.warn(
        `Failed to fetch pre-audit state for ${entity} (${objectId}):`,
        e,
      );
    }
    return null;
  }

  private auditIncludeFor(entity: string): Record<string, unknown> | undefined {
    switch (entity) {
      case 'Allocation':
        return {
          employee: { select: { id: true, name: true, email: true } },
          backupEmployee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        };
      case 'ActionPoint':
        return {
          owner: { select: { id: true, displayName: true, email: true } },
          project: { select: { id: true, name: true } },
        };
      case 'Task':
        return {
          project: { select: { id: true, name: true } },
        };
      case 'ProjectPhase':
      case 'ProjectMilestone':
        return {
          project: { select: { id: true, name: true } },
        };
      case 'TaskComment':
        return {
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        };
      case 'WorkspaceDocument':
        return {
          project: { select: { id: true, name: true } },
        };
      case 'TaskProgressUpdate':
        return {
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        };
      case 'TaskDependency':
        return {
          predecessor: { select: { id: true, title: true, projectId: true } },
          successor: { select: { id: true, title: true, projectId: true } },
        };
      default:
        return undefined;
    }
  }

  /**
   * Ensure payloads used for descriptions carry human names (project, employee, owner).
   */
  private async enrichNames(entity: string, value: unknown): Promise<unknown> {
    if (value == null) return value;

    if (Array.isArray(value)) {
      return Promise.all(value.map((row) => this.enrichNames(entity, row)));
    }

    if (typeof value !== 'object') return value;

    const record = { ...(value as Record<string, unknown>) };

    if (Array.isArray(record.created)) {
      record.created = await this.enrichNames(entity, record.created);
      return record;
    }

    if (record.updated && typeof record.updated === 'object') {
      record.updated = await this.enrichNames(entity, record.updated);
      return record;
    }

    // Lift nested task.project onto comment/progress rows when useful
    if (
      record.task &&
      typeof record.task === 'object' &&
      (record.task as { project?: unknown }).project &&
      !record.project
    ) {
      record.project = (record.task as { project: unknown }).project;
    }

    if (
      !record.project &&
      typeof record.projectId === 'string' &&
      record.projectId
    ) {
      const project = await this.prisma.project.findUnique({
        where: { id: record.projectId },
        select: { id: true, name: true },
      });
      if (project) {
        record.project = project;
        record.projectName = project.name;
      }
    }

    if (
      entity === 'Allocation' &&
      !record.employee &&
      typeof record.employeeId === 'string'
    ) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: record.employeeId },
        select: { id: true, name: true, email: true },
      });
      if (employee) {
        record.employee = employee;
        record.employeeName = employee.name;
      }
    }

    if (
      entity === 'Allocation' &&
      !record.employee &&
      typeof record.id === 'string'
    ) {
      const allocation = await this.prisma.allocation.findUnique({
        where: { id: record.id },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          backupEmployee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      });
      if (allocation) {
        record.employee = allocation.employee;
        record.employeeName = allocation.employee?.name;
        record.employeeId = allocation.employeeId;
        record.project = allocation.project;
        record.projectId = allocation.projectId;
        record.projectName = allocation.project?.name;
        record.role = record.role ?? allocation.role;
        if (record.backupEmployeeId === undefined) {
          record.backupEmployeeId = allocation.backupEmployeeId;
        }
      }
    }

    if (
      entity === 'Allocation' &&
      !record.backupEmployee &&
      typeof record.backupEmployeeId === 'string' &&
      record.backupEmployeeId
    ) {
      const backup = await this.prisma.employee.findUnique({
        where: { id: record.backupEmployeeId },
        select: { id: true, name: true, email: true },
      });
      if (backup) {
        record.backupEmployee = backup;
        record.backupEmployeeName = backup.name;
      }
    }

    if (
      entity === 'ActionPoint' &&
      !record.owner &&
      typeof record.ownerId === 'string'
    ) {
      const owner = await this.prisma.user.findUnique({
        where: { id: record.ownerId },
        select: { id: true, displayName: true, email: true },
      });
      if (owner) {
        record.owner = owner;
      }
    }

    return record;
  }

  private toPrismaModelName(entity: string): string | null {
    const map: Record<string, string> = {
      Task: 'task',
      TaskComment: 'taskComment',
      TaskAttachment: 'workspaceDocument',
      WorkspaceDocument: 'workspaceDocument',
      TaskDependency: 'taskDependency',
      TaskProgressUpdate: 'taskProgressUpdate',
      Project: 'project',
      ProjectMilestone: 'projectMilestone',
      ProjectPhase: 'projectPhase',
      Allocation: 'allocation',
      ActionPoint: 'actionPoint',
      User: 'user',
      File: 'file',
    };
    return map[entity] ?? null;
  }

  private maskSensitiveFields(obj: any): any {
    if (typeof obj === 'bigint') {
      return this.serializeBigInt(obj);
    }
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskSensitiveFields(item));
    }
    const masked = { ...obj };
    for (const key of Object.keys(masked)) {
      if (SENSITIVE_KEYS.includes(key)) {
        masked[key] = '***';
      } else if (typeof masked[key] === 'bigint') {
        masked[key] = this.serializeBigInt(masked[key]);
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveFields(masked[key]);
      }
    }
    return masked;
  }

  /** Prisma BigInt (e.g. sizeBytes) is not JSON-serializable by default. */
  private serializeBigInt(value: bigint): number | string {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  private toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
    if (value == null) return undefined;
    return JSON.parse(
      JSON.stringify(this.maskSensitiveFields(value), (_key, v) =>
        typeof v === 'bigint' ? this.serializeBigInt(v) : v,
      ),
    ) as Prisma.InputJsonValue;
  }
}
