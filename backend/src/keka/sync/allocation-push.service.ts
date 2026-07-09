import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';

type AllocationPushPayload = {
  projectName: string;
  role: string;
  hours: number | null;
  percent: number | null;
  startDate: string;
  endDate: string | null;
};

type KekaAllocationPushResponse = {
  succeeded?: boolean;
  data?: { id?: string };
};

@Injectable()
export class AllocationPushService {
  private readonly logger = new Logger(AllocationPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async pushAllocation(allocationId: string): Promise<string | null> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id: allocationId },
      include: {
        employee: { select: { kekaEmployeeId: true, name: true } },
        project: { select: { name: true } },
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

    const payload: AllocationPushPayload = {
      projectName: allocation.project.name,
      role: allocation.role,
      hours: allocation.hours != null ? Number(allocation.hours) : null,
      percent: allocation.percent != null ? Number(allocation.percent) : null,
      startDate: allocation.startDate.toISOString().slice(0, 10),
      endDate: allocation.endDate
        ? allocation.endDate.toISOString().slice(0, 10)
        : null,
    };

    try {
      const response = await this.kekaClient.post<KekaAllocationPushResponse>(
        `/psa/employees/${encodeURIComponent(kekaEmployeeId)}/allocations`,
        payload,
      );

      const ref = response.data?.id ?? `keka-alloc-${allocationId.slice(0, 8)}`;
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
  }
}
