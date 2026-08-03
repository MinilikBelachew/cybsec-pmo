import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
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

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
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

    let fired = 0;
    for (const rule of rules) {
      if (!this.matchesThreshold(rule.thresholdConfig, input.metricValue)) {
        continue;
      }

      const recipientUserIds = await this.resolveRecipientUserIds(rule);
      const channels =
        rule.channels.length > 0 ? rule.channels : ['in_app'];

      for (const channel of channels) {
        const existing = await this.prisma.alertEvent.findFirst({
          where: {
            ruleId: rule.id,
            objectType: input.objectType,
            objectId: input.objectId,
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
            objectType: input.objectType,
            objectId: input.objectId,
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
          input,
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
      const recipients = await this.resolveRecipientUserIds(event.rule);
      const ok = await this.deliver(
        event.id,
        event.channel,
        recipients,
        {
          eventType: event.rule.eventType,
          objectType: event.objectType,
          objectId: event.objectId ?? event.id,
          title: `Reminder: ${event.rule.eventType}`,
          body: `Alert for ${event.objectType} is still unacknowledged.`,
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
        await this.escalateToHierarchy(event.rule.escalationRole, {
          eventType: event.rule.eventType,
          objectType: event.objectType,
          objectId: event.objectId ?? event.id,
          title: `Escalated: ${event.rule.eventType}`,
          body: `Unacknowledged alert escalated to ${event.rule.escalationRole}.`,
        });
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
      const recipients = await this.resolveRecipientUserIds(event.rule);
      const ok = await this.deliver(
        event.id,
        event.channel,
        recipients,
        {
          eventType: event.rule.eventType,
          objectType: event.objectType,
          objectId: event.objectId ?? event.id,
          title: `Retry: ${event.rule.eventType}`,
          body: `Retrying alert delivery (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`,
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
          deliveryStatus: ok ? 'sent' : nextAttempt >= MAX_RETRY_ATTEMPTS ? 'dead' : 'failed',
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

  private async resolveRecipientUserIds(rule: {
    recipients: Array<{ role: { code: string } }>;
    escalationRole: string;
  }): Promise<string[]> {
    const roleCodes = new Set<string>();
    for (const r of rule.recipients) {
      roleCodes.add(r.role.code);
    }
    if (roleCodes.size === 0 && rule.escalationRole) {
      roleCodes.add(rule.escalationRole);
    }
    if (roleCodes.size === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: Array.from(roleCodes) } },
      },
      select: { id: true },
      take: 100,
    });
    return users.map((u) => u.id);
  }

  private async escalateToHierarchy(
    escalationRole: string,
    input: FireAlertInput,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: { code: escalationRole } },
      select: { id: true },
      take: 50,
    });
    if (users.length === 0) return;
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.ALERT_ESCALATED,
      recipientUserIds: users.map((u) => u.id),
      title: input.title,
      body: input.body,
      payload: {
        ...(input.payload ?? {}),
        objectType: input.objectType,
        objectId: input.objectId,
        escalationRole,
      },
      sourceObjectType: input.objectType,
      sourceObjectId: input.objectId,
      includeActorAsRecipient: true,
    });
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
}
