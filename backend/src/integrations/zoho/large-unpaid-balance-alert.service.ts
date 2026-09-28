import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../notifications/notifications.constants';
import { AppSettingsService } from '../../settings/app-settings.service';
import { PAYMENT_DELAY_RECIPIENT_ROLES } from './payment-delay-alert.service';

const PAID_LIKE_STATUSES = ['paid', 'void', 'cancelled'] as const;
const DEDUP_HOURS = 24;
const SCAN_LIMIT = 200;
const BOOKS_PAGE_LINK = '/dashboard/integrations/zoho-books';

export type LargeUnpaidBalanceAlertResult = {
  scanned: number;
  notified: number;
  skipped: number;
  threshold: number;
  disabled: boolean;
};

@Injectable()
export class LargeUnpaidBalanceAlertService {
  private readonly logger = new Logger(LargeUnpaidBalanceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly appSettings: AppSettingsService,
  ) {}

  async processLargeUnpaidBalanceAlerts(): Promise<LargeUnpaidBalanceAlertResult> {
    const { largeUnpaidBalanceThreshold: threshold } =
      await this.appSettings.getFinanceAlertSettings();

    if (threshold <= 0) {
      return {
        scanned: 0,
        notified: 0,
        skipped: 0,
        threshold,
        disabled: true,
      };
    }

    const thresholdDecimal = new Prisma.Decimal(threshold);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        projectId: { not: null },
        balance: { gte: thresholdDecimal },
        status: { notIn: [...PAID_LIKE_STATUSES] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        projectId: true,
        amount: true,
        balance: true,
        currency: true,
        dueDate: true,
        status: true,
        project: { select: { name: true } },
      },
      orderBy: { balance: 'desc' },
      take: SCAN_LIMIT,
    });

    if (invoices.length === 0) {
      return {
        scanned: 0,
        notified: 0,
        skipped: 0,
        threshold,
        disabled: false,
      };
    }

    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    const recent = await this.prisma.notification.findMany({
      where: {
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_LARGE_UNPAID,
        sourceObjectType: 'Invoice',
        sourceObjectId: { in: invoices.map((inv) => inv.id) },
        createdAt: { gte: since },
      },
      select: { sourceObjectId: true },
      distinct: ['sourceObjectId'],
    });
    const alreadyAlerted = new Set(
      recent
        .map((n) => n.sourceObjectId)
        .filter((id): id is string => Boolean(id)),
    );

    const recipientUserIds =
      await this.notifications.recipientsByRoleCodes([
        ...PAYMENT_DELAY_RECIPIENT_ROLES,
      ]);

    if (recipientUserIds.length === 0) {
      this.logger.warn(
        'Large unpaid balance alert: no active finance / pmo_lead / super_admin users',
      );
      return {
        scanned: invoices.length,
        notified: 0,
        skipped: invoices.length,
        threshold,
        disabled: false,
      };
    }

    let notified = 0;
    let skipped = 0;

    for (const inv of invoices) {
      if (alreadyAlerted.has(inv.id)) {
        skipped += 1;
        continue;
      }

      const balance = inv.balance?.toString() ?? '0';
      const amount = inv.amount.toString();
      const projectName = inv.project?.name ?? 'project';
      const due = inv.dueDate.toISOString().slice(0, 10);

      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_LARGE_UNPAID,
        recipientUserIds,
        title: `Invoice ${inv.invoiceNumber} large unpaid balance`,
        body: `Invoice ${inv.invoiceNumber} for ${projectName} has unpaid balance ${balance} ${inv.currency} (threshold ${threshold}). Amount ${amount}, due ${due}.`,
        payload: {
          invoiceId: inv.id,
          projectId: inv.projectId,
          invoiceNumber: inv.invoiceNumber,
          balance,
          threshold,
          link: BOOKS_PAGE_LINK,
        },
        sourceObjectType: 'Invoice',
        sourceObjectId: inv.id,
        includeActorAsRecipient: true,
      });

      notified += 1;
    }

    return {
      scanned: invoices.length,
      notified,
      skipped,
      threshold,
      disabled: false,
    };
  }
}
