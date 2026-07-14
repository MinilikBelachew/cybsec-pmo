import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { ProjectLinkService } from './project-link.service';
import { upsertFailedSyncRecord } from '../utils/failed-sync-record.util';

type KekaAllocationPushPayload = {
  employeeId: string;
  allocationPercentage?: number | null;
  billingRoleId?: string | null;
  billingRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

type KekaAllocationPushResponse = {
  succeeded?: boolean;
  data?: string | null;
  message?: string | null;
};

@Injectable()
export class AllocationPushService {
  private readonly logger = new Logger(AllocationPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
    private readonly projectLinkService: ProjectLinkService,
  ) {}

  async pushAllocation(allocationId: string): Promise<string | null> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id: allocationId },
      include: {
        employee: { select: { kekaEmployeeId: true, name: true } },
        project: {
          select: { id: true, name: true, kekaProjectId: true },
        },
      },
    });

    if (!allocation || allocation.status !== 'Active') {
      return null;
    }

    if (allocation.kekaSyncRef) {
      return allocation.kekaSyncRef;
    }

    const kekaEmployeeId = allocation.employee.kekaEmployeeId?.trim();
    if (!kekaEmployeeId) {
      await this.logFailure(
        allocationId,
        { allocationId },
        `Employee ${allocation.employee.name} has no Keka ID`,
      );
      return null;
    }

    let payload: KekaAllocationPushPayload | { allocationId: string } = {
      allocationId,
    };

    try {
      const kekaProjectId =
        allocation.project.kekaProjectId?.trim() ||
        (await this.projectLinkService.ensureProjectLinked(
          allocation.project.id,
        ));

      payload = {
        employeeId: kekaEmployeeId,
        allocationPercentage:
          allocation.percent != null
            ? Math.round(Number(allocation.percent))
            : null,
        startDate: allocation.startDate.toISOString(),
        endDate: allocation.endDate
          ? allocation.endDate.toISOString()
          : null,
      };

      const response = await this.kekaClient.post<KekaAllocationPushResponse>(
        `/psa/projects/${encodeURIComponent(kekaProjectId)}/allocations`,
        payload,
      );

      const ref =
        response.data?.trim() || `keka-alloc-${allocationId.slice(0, 8)}`;
      const syncedAt = new Date();

      await this.prisma.allocation.update({
        where: { id: allocationId },
        data: {
          kekaSyncRef: ref,
          kekaSyncedAt: syncedAt,
        },
      });

      await this.prisma.kekaSyncLog.create({
        data: {
          entityType: KEKA_ENTITY_TYPE.ALLOCATION,
          entityId: allocationId,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          status: KEKA_SYNC_STATUS.SUCCESS,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      return ref;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Keka allocation push failed';
      this.logger.error(`Allocation push failed for ${allocationId}: ${message}`);
      await this.logFailure(allocationId, payload, message);
      return null;
    }
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.ALLOCATION,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.ALLOCATION,
      entityId,
      direction: KEKA_SYNC_DIRECTION.OUTBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}
