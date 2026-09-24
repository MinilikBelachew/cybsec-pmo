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
import {
  ZOHO_ENTITY_TYPE,
  ZOHO_INTEGRATION,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';
import {
  isClosedWonStage,
  MappedCrmOpportunity,
  sourceOrderIdForDeal,
} from '../zoho.mapper';

export type ProvisionResult =
  | { status: 'skipped'; reason: string }
  | { status: 'created'; projectId: string; charterId: string }
  | { status: 'failed'; error: string };

@Injectable()
export class ClosedWonProvisioningService {
  private readonly logger = new Logger(ClosedWonProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async provisionIfNeeded(
    opportunityId: string,
    mapped: MappedCrmOpportunity,
  ): Promise<ProvisionResult> {
    if (!isClosedWonStage(mapped.stage)) {
      return { status: 'skipped', reason: 'not_closed_won' };
    }

    const sourceOrderId = sourceOrderIdForDeal(mapped.zohoOpportunityId);

    try {
      const existingByOpp = await this.prisma.project.findFirst({
        where: { crmOpportunityId: opportunityId },
        select: { id: true },
      });
      if (existingByOpp) {
        return { status: 'skipped', reason: 'project_already_linked' };
      }

      const existingCharter = await this.prisma.projectCharter.findUnique({
        where: { sourceOrderId },
        select: { id: true, projectId: true },
      });
      if (existingCharter) {
        return { status: 'skipped', reason: 'charter_already_exists' };
      }

      const department = await this.prisma.department.findFirst({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true },
      });
      if (!department) {
        throw new Error('No active department found for Closed Won provisioning');
      }

      const primaryPmId = await this.resolvePrimaryPmId();
      if (!primaryPmId) {
        throw new Error(
          'No PMO Lead or PM user found for Closed Won provisioning',
        );
      }

      const customerId = await this.resolveCustomerId(
        mapped.accountName,
        primaryPmId,
      );

      const dealDescription = mapped.description?.trim() || null;
      const dealName =
        mapped.name?.trim() ||
        `Zoho Deal ${mapped.zohoOpportunityId.slice(0, 8)}`;
      const objective =
        dealDescription && dealDescription.length >= 5
          ? dealDescription.slice(0, 500)
          : `Auto-created from Zoho CRM Closed Won: ${dealName}`;

      const startDate = this.parseDateOrToday(mapped.closingDate);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 90);

      const accountName = mapped.accountName?.trim() || null;
      const stakeholders = accountName
        ? `Customer: ${accountName}`
        : null;

      const incompleteFields: string[] = [
        'department',
        'primaryPm',
        'endDate',
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
      if (!dealDescription) {
        incompleteFields.push('purpose', 'scope');
      }
      if (!mapped.closingDate) {
        incompleteFields.push('startDate');
      }
      if (!accountName) {
        incompleteFields.push('customer', 'stakeholders');
      }
      if (mapped.expectedRevenue === null) {
        incompleteFields.push('value');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name: dealName.slice(0, 255),
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
              mapped.expectedRevenue === null
                ? null
                : new Prisma.Decimal(mapped.expectedRevenue),
            currency: 'USD',
            primaryPmId,
            status: ProjectStatus.Draft,
            crmOpportunityId: opportunityId,
            createdBy: primaryPmId,
          },
        });

        const charter = await tx.projectCharter.create({
          data: {
            projectId: project.id,
            customerId,
            sourceOrderId,
            status: 'Draft',
            purpose: dealDescription,
            scopeSummary: dealDescription,
            stakeholders,
            valueSnapshot:
              mapped.expectedRevenue === null
                ? null
                : new Prisma.Decimal(mapped.expectedRevenue),
            startDate,
            endDate,
            version: 1,
            incompleteFields,
          },
        });

        return { projectId: project.id, charterId: charter.id };
      });

      this.logger.log(
        `Provisioned Draft project ${result.projectId} + charter ${result.charterId} for Closed Won ${mapped.zohoOpportunityId}`,
      );
      await this.resolveProvisionFailures(mapped.zohoOpportunityId);
      return { status: 'created', ...result };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Closed Won provisioning failed';
      this.logger.warn(
        `Closed Won provision failed for ${mapped.zohoOpportunityId}: ${message}`,
      );
      await this.recordProvisionFailure(mapped.zohoOpportunityId, message, mapped);
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
    accountName: string | null,
    accountManagerId: string,
  ): Promise<string> {
    const displayName = (accountName?.trim() || 'Zoho CRM Account').slice(0, 255);

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
        notes: 'Auto-created from Zoho CRM Closed Won provisioning',
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
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.CHARTER_PROVISION,
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
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.CHARTER_PROVISION,
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
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.CHARTER_PROVISION,
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
