import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';

export type FireAlertInput = {
  eventType: string;
  objectType: string;
  objectId: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  /** Score / metric used for threshold matching (e.g. risk score). */
  metricValue?: number;
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_HRS = [1, 4, 12];
const ALERTS_PAGE_LINK = '/dashboard/alerts';

type AlertObjectContext = {
  objectLabel: string;
  objectTitle: string;
  projectId?: string;
  projectName?: string;
  detail?: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  /**
   * Match active catalogue rules for an event type, create AlertEvent rows,
   * deliver notifications, and schedule reminder / retry timestamps.
   */
  async fire(input: FireAlertInput): Promise<number> {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        isActive: true,
        eventType: input.eventType,
      },
      include: {
        recipients: {
          include: { role: { select: { id: true, code: true } } },
        },
      },
    });

    if (rules.length === 0) {
      return 0;
    }

    const enrichedInput = this.withAlertLink(input);
    const projectId = await this.resolveProjectId(
      enrichedInput.objectType,
      enrichedInput.objectId,
      enrichedInput.payload,
    );

    let fired = 0;
    for (const rule of rules) {
      if (!this.matchesThreshold(rule.thresholdConfig, enrichedInput.metricValue)) {
        continue;
      }

      const recipientUserIds = await this.resolveRecipientUserIds(
        rule,
        projectId,
      );
      const channels =
        rule.channels.length > 0 ? rule.channels : ['in_app'];

      for (const channel of channels) {
        const existing = await this.prisma.alertEvent.findFirst({
          where: {
            ruleId: rule.id,
            objectType: enrichedInput.objectType,
            objectId: enrichedInput.objectId,
            channel,
            ackedAt: null,
            deliveryStatus: { in: ['queued', 'sent', 'retrying'] },
          },
          select: { id: true },
        });
        if (existing) {
          continue;
        }

        const nextReminderAt = new Date(
          Date.now() + rule.reminderCadenceHrs * 60 * 60 * 1000,
        );

        const event = await this.prisma.alertEvent.create({
          data: {
            ruleId: rule.id,
            objectType: enrichedInput.objectType,
            objectId: enrichedInput.objectId,
            channel,
            deliveryStatus: 'queued',
            escalationLevel: 0,
            nextReminderAt,
          },
        });

        const delivered = await this.deliver(
          event.id,
          channel,
          recipientUserIds,
          enrichedInput,
          0,
        );
        if (!delivered) {
          await this.prisma.alertEvent.update({
            where: { id: event.id },
            data: {
              deliveryStatus: 'failed',
              nextReminderAt: new Date(
                Date.now() + RETRY_BACKOFF_HRS[0] * 60 * 60 * 1000,
              ),
              escalationLevel: 1,
            },
          });
        }
        fired += 1;
      }
    }
    return fired;
  }

  /** Reminder cadence for unacknowledged alerts (M4.3-04 / M4.3-05). */
  async processReminders(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.alertEvent.findMany({
      where: {
        ackedAt: null,
        nextReminderAt: { lte: now },
        deliveryStatus: { in: ['sent', 'queued', 'retrying'] },
      },
      include: {
        rule: {
          include: {
            recipients: {
              include: { role: { select: { id: true, code: true } } },
            },
          },
        },
      },
      take: 100,
    });

    let sent = 0;
    for (const event of due) {
      const objectId = event.objectId ?? event.id;
      const message = await this.buildFollowUpMessage({
        kind: 'reminder',
        objectType: event.objectType,
        objectId,
        escalationRole: event.rule.escalationRole,
      });
      const projectId = await this.resolveProjectId(
        event.objectType,
        objectId,
        message.payload,
      );
      const recipients = await this.resolveRecipientUserIds(
        event.rule,
        projectId,
      );
      const ok = await this.deliver(
        event.id,
        event.channel,
        recipients,
        {
          eventType: event.rule.eventType,
          objectType: event.objectType,
          objectId,
          title: message.title,
          body: message.body,
          payload: message.payload,
        },
        event.escalationLevel,
      );

      const nextReminderAt = new Date(
        Date.now() + event.rule.reminderCadenceHrs * 60 * 60 * 1000,
      );
      const escalate =
        Date.now() - event.firedAt.getTime() >=
        event.rule.escalationDelayHrs * 60 * 60 * 1000;

      await this.prisma.alertEvent.update({
        where: { id: event.id },
        data: {
          deliveryStatus: ok ? 'sent' : 'failed',
          nextReminderAt,
          escalationLevel: escalate
            ? event.escalationLevel + 1
            : event.escalationLevel,
        },
      });

      if (escalate) {
        const escalated = await this.buildFollowUpMessage({
          kind: 'escalation',
          objectType: event.objectType,
          objectId,
          escalationRole: event.rule.escalationRole,
        });
        await this.escalateToHierarchy(
          event.rule.escalationRole,
          {
            eventType: event.rule.eventType,
            objectType: event.objectType,
            objectId,
            title: escalated.title,
            body: escalated.body,
            payload: escalated.payload,
          },
          projectId,
        );
      }
      sent += 1;
    }
    return sent;
  }

  /**
   * Retry failed deliveries with backoff (M4.3-07).
   * Escalation level tracks attempt count for retry.
   */
  async processRetries(): Promise<number> {
    const now = new Date();
    const failed = await this.prisma.alertEvent.findMany({
      where: {
        ackedAt: null,
        deliveryStatus: 'failed',
        nextReminderAt: { lte: now },
        escalationLevel: { lt: MAX_RETRY_ATTEMPTS },
      },
      include: {
        rule: {
          include: {
            recipients: {
              include: { role: { select: { id: true, code: true } } },
            },
          },
        },
      },
      take: 100,
    });

    let retried = 0;
    for (const event of failed) {
      const attempt = event.escalationLevel;
      const objectId = event.objectId ?? event.id;
      const message = await this.buildFollowUpMessage({
        kind: 'retry',
        objectType: event.objectType,
        objectId,
        escalationRole: event.rule.escalationRole,
        attempt: attempt + 1,
      });
      const projectId = await this.resolveProjectId(
        event.objectType,
        objectId,
        message.payload,
      );
      const recipients = await this.resolveRecipientUserIds(
        event.rule,
        projectId,
      );
      const ok = await this.deliver(
        event.id,
        event.channel,
        recipients,
        {
          eventType: event.rule.eventType,
          objectType: event.objectType,
          objectId,
          title: message.title,
          body: message.body,
          payload: message.payload,
        },
        attempt,
      );

      const nextAttempt = attempt + 1;
      const backoffHrs =
        RETRY_BACKOFF_HRS[
          Math.min(nextAttempt, RETRY_BACKOFF_HRS.length - 1)
        ] ?? 12;

      await this.prisma.alertEvent.update({
        where: { id: event.id },
        data: {
          deliveryStatus:
            ok ? 'sent' : nextAttempt >= MAX_RETRY_ATTEMPTS ? 'dead' : 'failed',
          escalationLevel: nextAttempt,
          nextReminderAt: ok
            ? new Date(
                Date.now() + event.rule.reminderCadenceHrs * 60 * 60 * 1000,
              )
            : new Date(Date.now() + backoffHrs * 60 * 60 * 1000),
        },
      });
      retried += 1;
    }

    if (retried > 0) {
      this.logger.log(`Processed ${retried} alert retry attempt(s)`);
    }
    return retried;
  }

  private matchesThreshold(
    thresholdConfig: Prisma.JsonValue,
    metricValue?: number,
  ): boolean {
    if (metricValue == null) return true;
    if (!thresholdConfig || typeof thresholdConfig !== 'object') return true;
    const cfg = thresholdConfig as Record<string, unknown>;
    if (typeof cfg.scoreGte === 'number') {
      return metricValue >= cfg.scoreGte;
    }
    if (typeof cfg.min === 'number') {
      return metricValue >= cfg.min;
    }
    return true;
  }

  /**
   * Resolve users with the recipient (or escalation) roles who can access the
   * related project per their matrix recordScope (own_projects, assigned, …).
   */
  private async resolveRecipientUserIds(
    rule: {
      recipients: Array<{ role: { code: string } }>;
      escalationRole: string;
    },
    projectId: string | null,
  ): Promise<string[]> {
    const roleCodes = new Set<string>();
    for (const r of rule.recipients) {
      roleCodes.add(r.role.code);
    }
    if (roleCodes.size === 0 && rule.escalationRole) {
      roleCodes.add(rule.escalationRole);
    }
    if (roleCodes.size === 0) return [];

    return this.resolveScopedUserIds(Array.from(roleCodes), projectId);
  }

  private async escalateToHierarchy(
    escalationRole: string,
    input: FireAlertInput,
    projectId: string | null,
  ): Promise<void> {
    const userIds = await this.resolveScopedUserIds(
      [escalationRole],
      projectId,
    );
    if (userIds.length === 0) return;
    const enriched = this.withAlertLink(input);
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ALERT_ESCALATED,
      recipientUserIds: userIds,
      title: enriched.title,
      body: enriched.body,
      payload: {
        ...(enriched.payload ?? {}),
        objectType: enriched.objectType,
        objectId: enriched.objectId,
        escalationRole,
        link: ALERTS_PAGE_LINK,
      },
      sourceObjectType: enriched.objectType,
      sourceObjectId: enriched.objectId,
      includeActorAsRecipient: true,
    });
  }

  private async resolveScopedUserIds(
    roleCodes: string[],
    projectId: string | null,
  ): Promise<string[]> {
    if (roleCodes.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: roleCodes } },
      },
      select: {
        id: true,
        roleId: true,
        role: { select: { code: true } },
        employees: { select: { departmentId: true } },
      },
      take: 200,
    });

    if (!projectId) {
      return users.map((u) => u.id);
    }

    const scoped: string[] = [];
    await Promise.all(
      users.map(async (user) => {
        const caslUser: CaslUserContext = {
          id: user.id,
          roleId: user.roleId,
          roleCode: user.role.code,
          departmentId: user.employees?.departmentId ?? null,
        };
        const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
        const match = await this.prisma.project.findFirst({
          where: { AND: [{ id: projectId }, scopeWhere] },
          select: { id: true },
        });
        if (match) {
          scoped.push(user.id);
        }
      }),
    );
    return scoped;
  }

  private async resolveProjectId(
    objectType: string,
    objectId: string,
    payload?: Record<string, unknown>,
  ): Promise<string | null> {
    const fromPayload = payload?.projectId;
    if (typeof fromPayload === 'string' && fromPayload.length > 0) {
      return fromPayload;
    }

    if (objectType === 'Risk') {
      const risk = await this.prisma.risk.findFirst({
        where: { id: objectId },
        select: { projectId: true },
      });
      return risk?.projectId ?? null;
    }

    if (objectType === 'Issue') {
      const issue = await this.prisma.issue.findFirst({
        where: { id: objectId },
        select: { projectId: true },
      });
      return issue?.projectId ?? null;
    }

    return null;
  }

  private async deliver(
    eventId: string,
    channel: string,
    recipientUserIds: string[],
    input: FireAlertInput,
    _attempt: number,
  ): Promise<boolean> {
    try {
      if (recipientUserIds.length === 0) {
        await this.prisma.alertEvent.update({
          where: { id: eventId },
          data: { deliveryStatus: 'sent' },
        });
        return true;
      }

      // in_app / email both go through notifications service (email channel handled there)
      if (channel === 'in_app' || channel === 'email' || channel === 'both') {
        await this.notifications.notify({
          eventType: NOTIFICATION_EVENT_TYPE.ALERT_FIRED,
          recipientUserIds,
          title: input.title,
          body: input.body,
          payload: {
            ...(input.payload ?? {}),
            alertEventId: eventId,
            channel,
            objectType: input.objectType,
            objectId: input.objectId,
            link: ALERTS_PAGE_LINK,
          },
          sourceObjectType: input.objectType,
          sourceObjectId: input.objectId,
          actorId: input.actorId,
          includeActorAsRecipient: true,
        });
      }

      await this.prisma.alertEvent.update({
        where: { id: eventId },
        data: { deliveryStatus: 'sent' },
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Alert delivery failed for ${eventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private withAlertLink(input: FireAlertInput): FireAlertInput {
    return {
      ...input,
      payload: {
        ...(input.payload ?? {}),
        link: ALERTS_PAGE_LINK,
      },
    };
  }

  private async resolveObjectContext(
    objectType: string,
    objectId: string,
  ): Promise<AlertObjectContext> {
    if (objectType === 'Risk') {
      const risk = await this.prisma.risk.findFirst({
        where: { id: objectId },
        select: {
          id: true,
          title: true,
          score: true,
          projectId: true,
          project: { select: { name: true } },
        },
      });
      if (risk) {
        return {
          objectLabel: `risk “${risk.title}”`,
          objectTitle: risk.title,
          projectId: risk.projectId,
          projectName: risk.project?.name,
          detail: `score ${risk.score}`,
          payload: {
            riskId: risk.id,
            projectId: risk.projectId,
            link: ALERTS_PAGE_LINK,
          },
        };
      }
    }

    if (objectType === 'Issue') {
      const issue = await this.prisma.issue.findFirst({
        where: { id: objectId },
        select: {
          id: true,
          title: true,
          priority: true,
          projectId: true,
          project: { select: { name: true } },
        },
      });
      if (issue) {
        return {
          objectLabel: `issue “${issue.title}”`,
          objectTitle: issue.title,
          projectId: issue.projectId,
          projectName: issue.project?.name,
          detail: issue.priority,
          payload: {
            issueId: issue.id,
            projectId: issue.projectId,
            priority: issue.priority,
            link: ALERTS_PAGE_LINK,
          },
        };
      }
    }

    return {
      objectLabel: objectType.toLowerCase(),
      objectTitle: objectType,
      payload: {
        objectType,
        objectId,
        link: ALERTS_PAGE_LINK,
      },
    };
  }

  private async buildFollowUpMessage(params: {
    kind: 'reminder' | 'escalation' | 'retry';
    objectType: string;
    objectId: string;
    escalationRole: string;
    attempt?: number;
  }): Promise<{
    title: string;
    body: string;
    payload: Record<string, unknown>;
  }> {
    const ctx = await this.resolveObjectContext(
      params.objectType,
      params.objectId,
    );
    const projectSuffix = ctx.projectName ? ` (${ctx.projectName})` : '';
    const detailSuffix = ctx.detail ? ` · ${ctx.detail}` : '';

    if (params.kind === 'escalation') {
      return {
        title: `Escalated: ${ctx.objectTitle}`,
        body: `Unacknowledged ${ctx.objectLabel}${projectSuffix}${detailSuffix} escalated to ${params.escalationRole}.`,
        payload: ctx.payload,
      };
    }

    if (params.kind === 'retry') {
      return {
        title: `Retry: ${ctx.objectTitle}`,
        body: `Retrying alert delivery for ${ctx.objectLabel}${projectSuffix} (attempt ${params.attempt}/${MAX_RETRY_ATTEMPTS}).`,
        payload: ctx.payload,
      };
    }

    return {
      title: `Reminder: ${ctx.objectTitle}`,
      body: `${ctx.objectLabel}${projectSuffix}${detailSuffix} is still unacknowledged.`,
      payload: ctx.payload,
    };
  }
}
