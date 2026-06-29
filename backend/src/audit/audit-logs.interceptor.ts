import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../database/prisma.service';
import { resolveStatusChangeAction } from './status-change-audit.util';

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
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.socket.remoteAddress ||
      null;
    const isExternal = request.user?.isExternal || false;
    const isBreakGlass = request.user?.breakGlass === true;
    const bodyPayload = this.maskSensitiveFields(request.body);

    return new Observable((observer) => {
      this.getOldValue(auditTarget.objectType, auditTarget.resourceId)
        .then((oldValue) => {
          next.handle().subscribe({
            next: (response) => {
              observer.next(response);

              let finalObjectId = auditTarget.resourceId;
              let newValue = bodyPayload;

              if (response && typeof response === 'object') {
                if (response.id && UUID_REGEX.test(response.id)) {
                  finalObjectId = response.id;
                }
                if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
                  newValue = this.maskSensitiveFields(response);
                }
              }

              let auditAction = auditTarget.action;
              const statusChange = resolveStatusChangeAction(
                auditTarget.objectType,
                oldValue,
                newValue,
              );
              if (statusChange) {
                auditAction = statusChange.action;
                newValue = statusChange.newValue;
              }

              if (isBreakGlass) {
                newValue =
                  newValue && typeof newValue === 'object'
                    ? { ...newValue, breakGlassAction: true }
                    : { breakGlassAction: true };
              }

              this.auditLogsService
                .create({
                  action: auditAction,
                  objectType: auditTarget.objectType,
                  objectId: finalObjectId,
                  oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
                  newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
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
                  oldValue,
                  newValue,
                  ipAddress,
                  isExternal,
                }),
              );
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
    const nestedUuid = segmentsAfterUuid.find((part) => UUID_REGEX.test(part)) ?? null;
    const hasReview = segmentsAfterUuid.includes('review');

    const subEntityByRoot: Record<string, Record<string, string>> = {
      tasks: {
        comments: 'TaskComment',
        attachments: 'TaskAttachment',
        'progress-updates': 'TaskProgressUpdate',
      },
      projects: {
        milestones: 'ProjectMilestone',
      },
    };

    const objectType = subEntityByRoot[root]?.[sub];
    if (!objectType) {
      return null;
    }

    let action: string;
    if (sub === 'progress-updates' && hasReview && method === 'PATCH') {
      action = 'REVIEW_PROGRESS';
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
        });
        return record ? this.maskSensitiveFields(record) : null;
      }
    } catch (e) {
      this.logger.warn(
        `Failed to fetch pre-audit state for ${entity} (${objectId}):`,
        e,
      );
    }
    return null;
  }

  private toPrismaModelName(entity: string): string | null {
    const map: Record<string, string> = {
      Task: 'task',
      TaskComment: 'taskComment',
      TaskAttachment: 'taskAttachment',
      TaskDependency: 'taskDependency',
      TaskProgressUpdate: 'taskProgressUpdate',
      Project: 'project',
      ProjectMilestone: 'projectMilestone',
      User: 'user',
      File: 'file',
    };
    return map[entity] ?? null;
  }

  private maskSensitiveFields(obj: any): any {
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
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveFields(masked[key]);
      }
    }
    return masked;
  }
}
