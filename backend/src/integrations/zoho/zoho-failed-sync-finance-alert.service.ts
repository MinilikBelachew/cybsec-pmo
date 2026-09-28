import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../notifications/notifications.constants';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_INTEGRATION,
} from './zoho.constants';
import type { ZohoFailedSyncUpsertOutcome } from './utils/failed-sync-record.util';
import { PAYMENT_DELAY_RECIPIENT_ROLES } from './payment-delay-alert.service';

const DEDUP_HOURS = 24;

@Injectable()
export class ZohoFailedSyncFinanceAlertService {
  private readonly logger = new Logger(ZohoFailedSyncFinanceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Notify Finance when a Zoho failed-sync row is first created or newly dead-lettered.
   * Skips intermediate hourly retry bumps to avoid spam.
   */
  async maybeNotify(outcome: ZohoFailedSyncUpsertOutcome): Promise<void> {
    if (!outcome.isNew && !outcome.becameDeadLetter) {
      return;
    }

    const eventType = outcome.becameDeadLetter
      ? NOTIFICATION_EVENT_TYPE.ZOHO_SYNC_DEAD_LETTER
      : NOTIFICATION_EVENT_TYPE.ZOHO_SYNC_FAILURE;

    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    const recent = await this.prisma.notification.findFirst({
      where: {
        eventType,
        sourceObjectType: 'FailedSyncRecord',
        sourceObjectId: outcome.id,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) {
      return;
    }

    const recipientUserIds =
      await this.notifications.recipientsByRoleCodes([
        ...PAYMENT_DELAY_RECIPIENT_ROLES,
      ]);

    if (recipientUserIds.length === 0) {
      this.logger.warn(
        'Zoho sync-failure alert: no active finance / pmo_lead / super_admin users',
      );
      return;
    }

    const product =
      outcome.integration === ZOHO_BOOKS_INTEGRATION
        ? 'Zoho Books'
        : outcome.integration === ZOHO_INTEGRATION
          ? 'Zoho CRM'
          : outcome.integration;
    const link =
      outcome.integration === ZOHO_BOOKS_INTEGRATION
        ? '/dashboard/integrations/zoho-books'
        : '/dashboard/integrations/zoho';
    const isDead = eventType === NOTIFICATION_EVENT_TYPE.ZOHO_SYNC_DEAD_LETTER;

    await this.notifications.notify({
      eventType,
      recipientUserIds,
      title: isDead
        ? `${product} sync dead-lettered`
        : `${product} sync failed`,
      body: isDead
        ? `${outcome.entityType} ${outcome.entityId} exhausted retries (${outcome.retryCount}). ${outcome.errorMsg}`
        : `${outcome.entityType} ${outcome.entityId} failed to sync. ${outcome.errorMsg}`,
      payload: {
        failedSyncRecordId: outcome.id,
        integration: outcome.integration,
        entityType: outcome.entityType,
        entityId: outcome.entityId,
        retryCount: outcome.retryCount,
        link,
      },
      sourceObjectType: 'FailedSyncRecord',
      sourceObjectId: outcome.id,
      includeActorAsRecipient: true,
    });
  }
}
