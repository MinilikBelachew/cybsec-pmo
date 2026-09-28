import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FileAccessService } from '../../../files/file-access.service';
import { buildSowPdf, sowPdfFileName } from '../../../sows/sow-pdf';
import { parseSowSnapshot } from '../../../sows/sow-snapshot';
import { ZohoHttpClient } from '../client/zoho-http.client';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_ENTITY_TYPE,
  ZOHO_INTEGRATION,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';
import {
  resolveZohoFailedSyncRecord,
  upsertZohoFailedSyncRecord,
} from '../utils/failed-sync-record.util';
import { ZohoFailedSyncFinanceAlertService } from '../zoho-failed-sync-finance-alert.service';

export type SowWritebackResult = {
  success: boolean;
  message: string;
};

type SowWithProject = {
  id: string;
  version: number;
  status: string;
  sourceDataSnapshot: Prisma.JsonValue | null;
  approvedAt: Date | null;
  opportunityId: string | null;
  s3FinalKey: string | null;
  project: {
    id: string;
    name: string;
    crmOpportunityId: string | null;
  };
  opportunity: { zohoOpportunityId: string } | null;
};

@Injectable()
export class SowCrmWritebackService {
  private readonly logger = new Logger(SowCrmWritebackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zohoHttp: ZohoHttpClient,
    private readonly fileAccess: FileAccessService,
    private readonly financeAlert: ZohoFailedSyncFinanceAlertService,
  ) {}

  async writeback(sowId: string): Promise<SowWritebackResult> {
    try {
      const sow = await this.prisma.sowDocument.findUnique({
        where: { id: sowId },
        include: {
          project: {
            select: { id: true, name: true, crmOpportunityId: true },
          },
          opportunity: { select: { zohoOpportunityId: true } },
        },
      });
      if (!sow) {
        return { success: false, message: 'SOW not found' };
      }

      const dealId = await this.resolveDealId(sow);
      const salesorderId = await this.resolveSalesOrderId(sow.project.id);

      if (!dealId && !salesorderId) {
        await this.recordFailure(
          sowId,
          'No linked Zoho CRM deal or Books sales order for this SOW',
          { sowId, step: 'resolve_targets' },
        );
        return {
          success: false,
          message:
            'No linked Zoho CRM deal or Books sales order for this SOW',
        };
      }

      const { buffer, filename } = await this.resolvePdf(sow);
      const file = {
        buffer,
        filename,
        contentType: 'application/pdf',
      };

      let dealOk = !dealId;
      let booksOk = !salesorderId;
      let lastError: string | null = null;

      if (dealId) {
        try {
          await this.zohoHttp.crmUploadDealAttachment(dealId, file);
          dealOk = true;
        } catch (err) {
          lastError =
            err instanceof Error
              ? err.message
              : 'Zoho CRM Deal attachment upload failed';
          this.logger.warn(
            `SOW ${sowId} Deal attachment failed: ${lastError}`,
          );
        }
      }

      if (salesorderId) {
        try {
          await this.zohoHttp.booksUploadSalesOrderAttachment(
            salesorderId,
            file,
          );
          booksOk = true;
        } catch (err) {
          lastError =
            err instanceof Error
              ? err.message
              : 'Zoho Books sales order attachment upload failed';
          this.logger.warn(
            `SOW ${sowId} Books SO attachment failed: ${lastError}`,
          );
        }
      }

      if (!dealOk && !booksOk) {
        await this.recordFailure(sowId, lastError ?? 'Zoho attachment failed', {
          sowId,
          dealId,
          salesorderId,
          step: 'attachments',
        });
        return {
          success: false,
          message: lastError ?? 'Zoho attachment failed',
        };
      }

      // One side failed while the other succeeded — keep in admin queue for retry.
      if (!dealOk || !booksOk) {
        const partialMsg = !dealOk
          ? lastError ?? 'Zoho CRM Deal attachment failed (Books OK)'
          : lastError ?? 'Zoho Books sales order attachment failed (Deal OK)';
        this.logger.warn(`SOW ${sowId} partial writeback: ${partialMsg}`);
        await this.recordFailure(sowId, partialMsg, {
          sowId,
          dealId,
          salesorderId,
          dealOk,
          booksOk,
          step: 'partial_attachment',
        });
        return { success: false, message: partialMsg };
      }

      await this.prisma.sowDocument.update({
        where: { id: sowId },
        data: { crmWrittenBackAt: new Date() },
      });
      await this.resolveFailures(sowId);

      return {
        success: true,
        message:
          dealId && salesorderId
            ? 'SOW attached to Zoho Deal and Books sales order'
            : dealId
              ? 'SOW attached to Zoho Deal'
              : 'SOW attached to Zoho Books sales order',
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'SOW writeback failed';
      this.logger.warn(`SOW writeback failed for ${sowId}: ${message}`);
      await this.recordFailure(sowId, message, { sowId, step: 'unexpected' });
      return { success: false, message };
    }
  }

  /** Alias used by the Zoho failed-sync retry loop. */
  async writebackByEntityId(sowId: string): Promise<SowWritebackResult> {
    return this.writeback(sowId);
  }

  private async resolveDealId(sow: SowWithProject): Promise<string | null> {
    if (sow.opportunity?.zohoOpportunityId) {
      return sow.opportunity.zohoOpportunityId;
    }
    if (sow.project.crmOpportunityId) {
      const opp = await this.prisma.crmOpportunity.findUnique({
        where: { id: sow.project.crmOpportunityId },
        select: { zohoOpportunityId: true },
      });
      return opp?.zohoOpportunityId ?? null;
    }
    return null;
  }

  private async resolveSalesOrderId(
    projectId: string,
  ): Promise<string | null> {
    const charter = await this.prisma.projectCharter.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { sourceOrderId: true },
    });
    const sourceOrderId = charter?.sourceOrderId;
    if (!sourceOrderId?.startsWith('zoho-so:')) {
      return null;
    }
    return sourceOrderId.slice('zoho-so:'.length) || null;
  }

  private async resolvePdf(
    sow: SowWithProject,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const filename = sowPdfFileName(sow.project.name, sow.version);

    if (sow.s3FinalKey) {
      try {
        const signed = await this.fileAccess.getSignedDownloadUrl(
          sow.s3FinalKey,
          filename,
        );
        const response = await fetch(signed.url);
        if (!response.ok) {
          throw new Error(`Failed to download SOW file (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), filename };
      } catch (err) {
        this.logger.warn(
          `Falling back to generated PDF for SOW ${sow.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const snapshot = parseSowSnapshot(sow.sourceDataSnapshot);
    const buffer = await buildSowPdf({
      projectName: sow.project.name,
      status: sow.status,
      version: sow.version,
      ...snapshot,
      approvedAt: sow.approvedAt ? sow.approvedAt.toISOString() : null,
      generatedAt: new Date().toISOString(),
    });
    return { buffer, filename };
  }

  private async resolveFailures(sowId: string): Promise<void> {
    await resolveZohoFailedSyncRecord(this.prisma, {
      integration: ZOHO_INTEGRATION,
      entityType: ZOHO_ENTITY_TYPE.SOW_WRITEBACK,
      entityId: sowId,
    });
    await resolveZohoFailedSyncRecord(this.prisma, {
      integration: ZOHO_BOOKS_INTEGRATION,
      entityType: ZOHO_ENTITY_TYPE.SOW_WRITEBACK,
      entityId: sowId,
    });
  }

  private pickFailureIntegration(payload: unknown): string {
    const p = payload as {
      dealId?: string | null;
      salesorderId?: string | null;
      dealOk?: boolean;
      booksOk?: boolean;
      step?: string;
    };
    // Prefer the integration that still needs a successful attach.
    if (p?.step === 'partial_attachment') {
      if (p.dealOk === false) return ZOHO_INTEGRATION;
      if (p.booksOk === false) return ZOHO_BOOKS_INTEGRATION;
    }
    if (p?.dealId) return ZOHO_INTEGRATION;
    if (p?.salesorderId) return ZOHO_BOOKS_INTEGRATION;
    return ZOHO_INTEGRATION;
  }

  private async recordFailure(
    sowId: string,
    errorMsg: string,
    payload: unknown,
  ): Promise<void> {
    const outcome = await upsertZohoFailedSyncRecord(this.prisma, {
      integration: this.pickFailureIntegration(payload),
      entityType: ZOHO_ENTITY_TYPE.SOW_WRITEBACK,
      entityId: sowId,
      direction: ZOHO_SYNC_DIRECTION.OUTBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
    await this.financeAlert.maybeNotify(outcome);
  }
}
