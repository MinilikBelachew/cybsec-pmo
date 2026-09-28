import { Injectable, Logger } from '@nestjs/common';
import {
  BillingModel,
  EngagementType,
  PartyType,
  Prisma,
  ProjectMethodology,
  ProjectStatus,
  PriorityLevel,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ROLE_ID_BY_CODE } from '../../../roles/role-catalog';
import { ZohoHttpClient } from '../client/zoho-http.client';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_ENTITY_TYPE,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';
import {
  isConfirmedSalesOrderStatus,
  mapZohoBooksSalesOrder,
  MappedBooksSalesOrder,
  sourceOrderIdForSalesOrder,
  ZohoBooksSalesOrderRecord,
} from '../zoho.mapper';
import type { ProvisionResult } from './closed-won-provisioning.service';

export type ConfirmedOrderSyncResult = {
  fetched: number;
  confirmed: number;
  created: number;
  skipped: number;
  failed: number;
};

@Injectable()
export class ConfirmedOrderCharterService {
  private readonly logger = new Logger(ConfirmedOrderCharterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zohoHttp: ZohoHttpClient,
  ) {}

  async syncConfirmedOrders(): Promise<ConfirmedOrderSyncResult> {
    const orders =
      await this.zohoHttp.booksGetAllSalesOrders<ZohoBooksSalesOrderRecord>();

    let confirmed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const raw of orders) {
      if (!isConfirmedSalesOrderStatus(raw.status, raw.order_status)) {
        continue;
      }
      confirmed += 1;

      const mapped = mapZohoBooksSalesOrder(raw);
      const result = await this.provisionIfNeeded(mapped);
      if (result.status === 'created') created += 1;
      else if (result.status === 'failed') failed += 1;
      else skipped += 1;
    }

    return {
      fetched: orders.length,
      confirmed,
      created,
      skipped,
      failed,
    };
  }

  async provisionSalesOrderByZohoId(
    salesorderId: string,
  ): Promise<{ success: boolean; message: string }> {
    const raw =
      await this.zohoHttp.booksGetSalesOrderById<ZohoBooksSalesOrderRecord>(
        salesorderId,
      );
    if (!raw) {
      return { success: false, message: 'Sales order not found in Zoho Books' };
    }

    if (!isConfirmedSalesOrderStatus(raw.status, raw.order_status)) {
      const status = raw.status ?? raw.order_status ?? 'unknown';
      return {
        success: false,
        message: `Sales order status is not confirmed (${status})`,
      };
    }

    const mapped = mapZohoBooksSalesOrder(raw);
    const result = await this.provisionIfNeeded(mapped);
    if (result.status === 'created') {
      return {
        success: true,
        message: `Draft charter created for ${mapped.salesOrderNumber ?? salesorderId}`,
      };
    }
    if (result.status === 'skipped') {
      return {
        success: true,
        message: `Already provisioned (${result.reason})`,
      };
    }
    return { success: false, message: result.error };
  }

  async provisionIfNeeded(
    mapped: MappedBooksSalesOrder,
  ): Promise<ProvisionResult> {
    const sourceOrderId = sourceOrderIdForSalesOrder(mapped.zohoSalesOrderId);

    try {
      const existingCharter = await this.prisma.projectCharter.findUnique({
        where: { sourceOrderId },
        select: { id: true, projectId: true },
      });
      if (existingCharter) {
        return { status: 'skipped', reason: 'charter_already_exists' };
      }

      // Dedupe vs CRM Closed Won: SO linked to a Deal that already has a project.
      if (mapped.zohoCrmPotentialId) {
        const byOpp = await this.prisma.project.findFirst({
          where: {
            crmOpportunity: {
              zohoOpportunityId: mapped.zohoCrmPotentialId,
            },
          },
          select: { id: true },
        });
        if (byOpp) {
          const charterOnProject = await this.prisma.projectCharter.findFirst({
            where: { projectId: byOpp.id },
            select: { id: true, sourceOrderId: true },
            orderBy: { createdAt: 'desc' },
          });
          if (charterOnProject && !charterOnProject.sourceOrderId) {
            await this.prisma.projectCharter.update({
              where: { id: charterOnProject.id },
              data: { sourceOrderId },
            });
          }
          await this.resolveProvisionFailures(mapped.zohoSalesOrderId);
          return { status: 'skipped', reason: 'deal_already_provisioned' };
        }
      }

      const department = await this.prisma.department.findFirst({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true },
      });
      if (!department) {
        throw new Error(
          'No active department found for confirmed-order provisioning',
        );
      }

      const primaryPmId = await this.resolvePrimaryPmId();
      if (!primaryPmId) {
        throw new Error(
          'No PMO Lead or PM user found for confirmed-order provisioning',
        );
      }

      const customerId = await this.resolveCustomerId(
        mapped.customerName,
        primaryPmId,
      );

      const orderLabel =
        mapped.salesOrderNumber?.trim() ||
        `Zoho SO ${mapped.zohoSalesOrderId.slice(0, 8)}`;
      const notes = mapped.notes?.trim() || null;
      const objective =
        notes && notes.length >= 5
          ? notes.slice(0, 500)
          : `Auto-created from Zoho Books confirmed order: ${orderLabel}`;

      const startDate = this.parseDateOrToday(mapped.orderDate);
      const endDate = mapped.shipmentDate
        ? this.parseDateOrToday(mapped.shipmentDate)
        : (() => {
            const d = new Date(startDate);
            d.setUTCDate(d.getUTCDate() + 90);
            return d;
          })();

      const incompleteFields: string[] = [
        'department',
        'primaryPm',
        'engagementType',
        'billingModel',
        'successCriteria',
        'scopeExclusions',
        'keyDeliverables',
        'highLevelRisks',
        'milestoneSchedule',
        'resourceEstimates',
        'pmAuthority',
      ];
      if (!notes) {
        incompleteFields.push('purpose', 'scope');
      }
      if (!mapped.orderDate) {
        incompleteFields.push('startDate');
      }
      if (!mapped.shipmentDate) {
        incompleteFields.push('endDate');
      }
      if (!mapped.customerName) {
        incompleteFields.push('customer', 'stakeholders');
      }
      if (mapped.total === null) {
        incompleteFields.push('value');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name: orderLabel.slice(0, 255),
            objective,
            departmentId: department.id,
            customerId,
            engagementType: EngagementType.Implementation,
            billingModel: BillingModel.Fixed_Price,
            methodology: ProjectMethodology.Agile,
            priority: PriorityLevel.Medium,
            startDate,
            endDate,
            value:
              mapped.total === null ? null : new Prisma.Decimal(mapped.total),
            currency: mapped.currency?.slice(0, 3) || 'USD',
            primaryPmId,
            status: ProjectStatus.Draft,
            createdBy: primaryPmId,
          },
        });

        const charter = await tx.projectCharter.create({
          data: {
            projectId: project.id,
            customerId,
            sourceOrderId,
            status: 'Draft',
            purpose: notes,
            scopeSummary: notes,
            stakeholders: mapped.customerName
              ? `Customer: ${mapped.customerName}`
              : null,
            valueSnapshot:
              mapped.total === null ? null : new Prisma.Decimal(mapped.total),
            startDate,
            endDate,
            version: 1,
            incompleteFields,
          },
        });

        return { projectId: project.id, charterId: charter.id };
      });

      this.logger.log(
        `Provisioned Draft project ${result.projectId} + charter ${result.charterId} for SO ${mapped.zohoSalesOrderId}`,
      );
      await this.resolveProvisionFailures(mapped.zohoSalesOrderId);
      return { status: 'created', ...result };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Confirmed order charter provisioning failed';
      this.logger.warn(
        `Confirmed order provision failed for ${mapped.zohoSalesOrderId}: ${message}`,
      );
      await this.recordProvisionFailure(
        mapped.zohoSalesOrderId,
        message,
        mapped,
      );
      return { status: 'failed', error: message };
    }
  }

  private async resolvePrimaryPmId(): Promise<string | null> {
    const pmoLead = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        roleId: ROLE_ID_BY_CODE.pmo_lead,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (pmoLead) {
      return pmoLead.id;
    }

    const pm = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        roleId: ROLE_ID_BY_CODE.pm,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return pm?.id ?? null;
  }

  private async resolveCustomerId(
    customerName: string | null,
    accountManagerId: string,
  ): Promise<string> {
    const displayName = (
      customerName?.trim() || 'Zoho Books Customer'
    ).slice(0, 255);

    const existing = await this.prisma.customer.findFirst({
      where: {
        displayName: { equals: displayName, mode: 'insensitive' },
        status: 'Active',
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.customer.create({
      data: {
        type: PartyType.Company,
        companyName: displayName,
        displayName,
        status: 'Active',
        accountManagerId,
        notes: 'Auto-created from Zoho Books confirmed order',
      },
      select: { id: true },
    });
    return created.id;
  }

  private parseDateOrToday(value: string | null): Date {
    if (value) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    const today = new Date();
    return new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
  }

  private async recordProvisionFailure(
    entityId: string,
    errorMsg: string,
    payload: unknown,
  ): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.failedSyncRecord.findFirst({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.SALES_ORDER_CHARTER,
        entityId,
        isResolved: false,
      },
    });

    if (existing) {
      await this.prisma.failedSyncRecord.update({
        where: { id: existing.id },
        data: {
          errorMsg,
          retryCount: existing.retryCount + 1,
          lastAttempted: now,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      return;
    }

    await this.prisma.failedSyncRecord.create({
      data: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.SALES_ORDER_CHARTER,
        entityId,
        direction: ZOHO_SYNC_DIRECTION.INBOUND,
        errorMsg,
        retryCount: 1,
        lastAttempted: now,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveProvisionFailures(entityId: string): Promise<void> {
    await this.prisma.failedSyncRecord.updateMany({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.SALES_ORDER_CHARTER,
        entityId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }
}
