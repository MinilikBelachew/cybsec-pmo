import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../notifications/notifications.constants';

const PAID_LIKE_STATUSES = ['paid', 'void', 'cancelled', 'draft'] as const;

/** Roles that receive payment-delay alerts (never project PM by role). */
export const PAYMENT_DELAY_RECIPIENT_ROLES = [
  'finance',
  'pmo_lead',
  'super_admin',
] as const;

const DEDUP_HOURS = 24;
const SCAN_LIMIT = 200;
const BOOKS_PAGE_LINK = '/dashboard/integrations/zoho-books';

export type PaymentDelayAlertResult = {
  scanned: number;
  notified: number;
  skipped: number;
};

function startOfUtcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class PaymentDelayAlertService {
  private readonly logger = new Logger(PaymentDelayAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async processPaymentDelayAlerts(): Promise<PaymentDelayAlertResult> {
    const today = startOfUtcToday();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        projectId: { not: null },
        dueDate: { lt: today },
        OR: [
          { balance: { gt: 0 } },
          {
            AND: [
              { balance: null },
              { status: { notIn: [...PAID_LIKE_STATUSES] } },
            ],
          },
        ],
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
      orderBy: { dueDate: 'asc' },
      take: SCAN_LIMIT,
    });

    if (invoices.length === 0) {
      return { scanned: 0, notified: 0, skipped: 0 };
    }

    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    const recent = await this.prisma.notification.findMany({
      where: {
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_PAYMENT_DELAY,
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
        'Payment-delay alert: no active finance / pmo_lead / super_admin users',
      );
      return {
        scanned: invoices.length,
        notified: 0,
        skipped: invoices.length,
      };
    }

    let notified = 0;
    let skipped = 0;

    for (const inv of invoices) {
      if (alreadyAlerted.has(inv.id)) {
        skipped += 1;
        continue;
      }

      const due = toIsoDate(inv.dueDate);
      const amount = inv.amount.toString();
      const balance =
        inv.balance != null ? inv.balance.toString() : amount;
      const projectName = inv.project?.name ?? 'project';

      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_PAYMENT_DELAY,
        recipientUserIds,
        title: `Invoice ${inv.invoiceNumber} payment delayed`,
        body: `Invoice ${inv.invoiceNumber} for ${projectName} is overdue (due ${due}). Amount ${amount} ${inv.currency}, balance ${balance}.`,
        payload: {
          invoiceId: inv.id,
          projectId: inv.projectId,
          invoiceNumber: inv.invoiceNumber,
          dueDate: due,
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
    };
  }
}
