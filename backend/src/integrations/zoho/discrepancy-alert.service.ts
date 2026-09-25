import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../notifications/notifications.constants';

/** Same audience as payment-delay alerts (never project PM by role). */
export const DISCREPANCY_RECIPIENT_ROLES = [
  'finance',
  'pmo_lead',
  'super_admin',
] as const;

const DEDUP_HOURS = 24;
const SCAN_LIMIT = 200;
const BOOKS_PAGE_LINK = '/dashboard/integrations/zoho-books';
/** Absolute tolerance in invoice currency units (e.g. 0.01 = 1 cent). */
const AMOUNT_TOLERANCE = new Prisma.Decimal('0.01');

export type DiscrepancyAlertResult = {
  scanned: number;
  mismatched: number;
  cleared: number;
  notified: number;
  skipped: number;
};

@Injectable()
export class DiscrepancyAlertService {
  private readonly logger = new Logger(DiscrepancyAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Re-evaluate one invoice after milestone link/unlink (or amount change).
   * Updates discrepancyNote; notifies when newly mismatched (deduped).
   */
  async evaluateInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        projectId: true,
        matchedMilestoneId: true,
        amount: true,
        currency: true,
        discrepancyNote: true,
        project: { select: { name: true } },
        milestone: { select: { id: true, title: true, amount: true } },
      },
    });
    if (!invoice) return;

    const outcome = this.compare(invoice);
    if (outcome.note !== (invoice.discrepancyNote ?? null)) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { discrepancyNote: outcome.note },
      });
    }

    if (outcome.mismatched) {
      await this.notifyIfNeeded([
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          projectId: invoice.projectId,
          projectName: invoice.project?.name ?? null,
          currency: invoice.currency,
          note: outcome.note!,
        },
      ]);
    }
  }

  async processDiscrepancyAlerts(): Promise<DiscrepancyAlertResult> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        matchedMilestoneId: { not: null },
      },
      select: {
        id: true,
        invoiceNumber: true,
        projectId: true,
        amount: true,
        currency: true,
        discrepancyNote: true,
        project: { select: { name: true } },
        milestone: { select: { id: true, title: true, amount: true } },
      },
      orderBy: { syncedAt: 'desc' },
      take: SCAN_LIMIT,
    });

    if (invoices.length === 0) {
      return {
        scanned: 0,
        mismatched: 0,
        cleared: 0,
        notified: 0,
        skipped: 0,
      };
    }

    let mismatched = 0;
    let cleared = 0;
    const toNotify: Array<{
      id: string;
      invoiceNumber: string;
      projectId: string | null;
      projectName: string | null;
      currency: string;
      note: string;
    }> = [];

    for (const inv of invoices) {
      const outcome = this.compare(inv);
      const previous = inv.discrepancyNote ?? null;

      if (outcome.note !== previous) {
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { discrepancyNote: outcome.note },
        });
        if (!outcome.mismatched && previous) {
          cleared += 1;
        }
      }

      if (outcome.mismatched && outcome.note) {
        mismatched += 1;
        toNotify.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          projectId: inv.projectId,
          projectName: inv.project?.name ?? null,
          currency: inv.currency,
          note: outcome.note,
        });
      }
    }

    // Also clear notes on invoices that no longer have a milestone link
    // but still carry a stale discrepancyNote (outside the matched scan).
    const stale = await this.prisma.invoice.updateMany({
      where: {
        matchedMilestoneId: null,
        discrepancyNote: { not: null },
      },
      data: { discrepancyNote: null },
    });
    cleared += stale.count;

    const { notified, skipped } = await this.notifyIfNeeded(toNotify);

    return {
      scanned: invoices.length,
      mismatched,
      cleared,
      notified,
      skipped,
    };
  }

  private compare(inv: {
    amount: Prisma.Decimal;
    currency: string;
    milestone: { title: string; amount: Prisma.Decimal | null } | null;
  }): { mismatched: boolean; note: string | null } {
    const milestoneAmount = inv.milestone?.amount ?? null;
    if (!inv.milestone || milestoneAmount == null) {
      return { mismatched: false, note: null };
    }

    const diff = inv.amount.minus(milestoneAmount).abs();
    if (diff.lte(AMOUNT_TOLERANCE)) {
      return { mismatched: false, note: null };
    }

    const signed = inv.amount.minus(milestoneAmount);
    const milestoneTitle = inv.milestone.title;
    const note = `Invoice ${inv.amount.toString()} ${inv.currency} vs milestone "${milestoneTitle}" expected ${milestoneAmount.toString()} ${inv.currency} (diff ${signed.toString()})`;
    return { mismatched: true, note };
  }

  private async notifyIfNeeded(
    items: Array<{
      id: string;
      invoiceNumber: string;
      projectId: string | null;
      projectName: string | null;
      currency: string;
      note: string;
    }>,
  ): Promise<{ notified: number; skipped: number }> {
    if (items.length === 0) {
      return { notified: 0, skipped: 0 };
    }

    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    const recent = await this.prisma.notification.findMany({
      where: {
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_DISCREPANCY,
        sourceObjectType: 'Invoice',
        sourceObjectId: { in: items.map((i) => i.id) },
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
        ...DISCREPANCY_RECIPIENT_ROLES,
      ]);

    if (recipientUserIds.length === 0) {
      this.logger.warn(
        'Discrepancy alert: no active finance / pmo_lead / super_admin users',
      );
      return { notified: 0, skipped: items.length };
    }

    let notified = 0;
    let skipped = 0;

    for (const item of items) {
      if (alreadyAlerted.has(item.id)) {
        skipped += 1;
        continue;
      }

      const projectName = item.projectName ?? 'project';
      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.INVOICE_DISCREPANCY,
        recipientUserIds,
        title: `Invoice ${item.invoiceNumber} amount discrepancy`,
        body: `Invoice ${item.invoiceNumber} for ${projectName}: ${item.note}`,
        payload: {
          invoiceId: item.id,
          projectId: item.projectId,
          invoiceNumber: item.invoiceNumber,
          link: BOOKS_PAGE_LINK,
        },
        sourceObjectType: 'Invoice',
        sourceObjectId: item.id,
        includeActorAsRecipient: true,
      });
      notified += 1;
    }

    return { notified, skipped };
  }
}
