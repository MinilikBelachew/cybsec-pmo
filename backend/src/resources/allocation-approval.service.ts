import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { AllocationPushService } from '../integrations/keka/sync/allocation-push.service';
import {
  buildAvailabilitySummary,
  sumOverlappingAllocationHours,
} from '../projects/utils/allocation-availability.util';
import {
  AllocationApprovalDecisionDto,
  AllocationApprovalListResponseDto,
  AllocationApprovalRowDto,
  QueryAllocationApprovalsDto,
  RejectAllocationApprovalDto,
} from './dto/allocation-approval.dto';

const ALLOCATION_INCLUDE = {
  employee: {
    select: {
      weeklyHours: true,
      name: true,
      designation: true,
      department: { select: { name: true } },
    },
  },
  project: { select: { id: true, name: true } },
  requester: { select: { id: true, displayName: true } },
} as const;

type AllocationRow = Prisma.AllocationGetPayload<{
  include: typeof ALLOCATION_INCLUDE;
}>;

@Injectable()
export class AllocationApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly allocationPushService: AllocationPushService,
  ) {}

  async findPending(
    query: QueryAllocationApprovalsDto,
    caslUser: CaslUserContext,
  ): Promise<AllocationApprovalListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'requestedAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const projectWhere = this.recordScopeWhere.teamApprovalProjectWhere(caslUser);

    const allocations = await this.prisma.allocation.findMany({
      where: {
        status: 'Pending',
        project: projectWhere,
        ...(query.search
          ? {
              OR: [
                {
                  employee: {
                    name: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  project: {
                    name: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  role: { contains: query.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
      include: ALLOCATION_INCLUDE,
      orderBy: { requestedAt: 'desc' },
    });

    const rows = await Promise.all(
      allocations.map((allocation) => this.toApprovalRow(allocation)),
    );

    const sorted = sortApprovalRows(rows, sortBy, sortOrder);
    const total = sorted.length;
    const start = (page - 1) * limit;

    return {
      rows: sorted.slice(start, start + limit),
      page,
      limit,
      total,
    };
  }

  async approve(
    allocationId: string,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<AllocationApprovalDecisionDto> {
    const allocation = await this.getPendingAllocation(allocationId, caslUser);

    if (allocation.requestedBy === actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { allocation: 'cannotApproveOwnRequest' },
      });
    }

    const updated = await this.prisma.allocation.update({
      where: { id: allocationId },
      data: {
        status: 'Active',
        approvedBy: actorId,
        rejectionComment: null,
      },
      include: ALLOCATION_INCLUDE,
    });

    const kekaSyncRef = await this.allocationPushService.pushAllocation(allocationId);
    const row = await this.toApprovalRow(updated);

    return { allocation: row, kekaSyncRef };
  }

  async reject(
    allocationId: string,
    actorId: string,
    caslUser: CaslUserContext,
    dto: RejectAllocationApprovalDto,
  ): Promise<AllocationApprovalDecisionDto> {
    const allocation = await this.getPendingAllocation(allocationId, caslUser);

    if (allocation.requestedBy === actorId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { allocation: 'cannotRejectOwnRequest' },
      });
    }

    const updated = await this.prisma.allocation.update({
      where: { id: allocationId },
      data: {
        status: 'Rejected',
        approvedBy: actorId,
        rejectionComment: dto.comment?.trim() || null,
      },
      include: ALLOCATION_INCLUDE,
    });

    const row = await this.toApprovalRow(updated);
    return { allocation: row, kekaSyncRef: null };
  }

  private async getPendingAllocation(
    allocationId: string,
    caslUser: CaslUserContext,
  ): Promise<AllocationRow> {
    const projectWhere = this.recordScopeWhere.teamApprovalProjectWhere(caslUser);

    const allocation = await this.prisma.allocation.findFirst({
      where: {
        id: allocationId,
        status: 'Pending',
        project: projectWhere,
      },
      include: ALLOCATION_INCLUDE,
    });

    if (!allocation) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { allocation: 'pendingAllocationNotFound' },
      });
    }

    return allocation;
  }

  private async toApprovalRow(
    allocation: AllocationRow,
  ): Promise<AllocationApprovalRowDto> {
    const weeklyCapacity = Number(allocation.employee.weeklyHours);
    const otherAllocations = await this.prisma.allocation.findMany({
      where: {
        employeeId: allocation.employeeId,
        status: 'Active',
        id: { not: allocation.id },
      },
    });

    const windowStart = allocation.startDate;
    const windowEnd = allocation.endDate ?? allocation.startDate;
    const allocatedOther = sumOverlappingAllocationHours(
      otherAllocations,
      weeklyCapacity,
      windowStart,
      windowEnd,
    );
    const pendingHours =
      allocation.hours != null
        ? Number(allocation.hours)
        : allocation.percent != null
          ? (weeklyCapacity * Number(allocation.percent)) / 100
          : 0;
    const summary = buildAvailabilitySummary(
      weeklyCapacity,
      allocatedOther + pendingHours,
    );

    if (!allocation.requester || !allocation.requestedAt) {
      throw new Error(`Allocation ${allocation.id} is missing request metadata`);
    }

    return {
      id: allocation.id,
      projectId: allocation.projectId,
      projectName: allocation.project.name,
      employeeId: allocation.employeeId,
      employeeName: allocation.employee.name,
      designation: allocation.employee.designation,
      department: allocation.employee.department.name,
      role: allocation.role,
      hours: allocation.hours != null ? Number(allocation.hours) : null,
      percent: allocation.percent != null ? Number(allocation.percent) : null,
      startDate: allocation.startDate.toISOString().slice(0, 10),
      endDate: allocation.endDate
        ? allocation.endDate.toISOString().slice(0, 10)
        : null,
      weeklyCapacityHours: summary.weeklyCapacityHours,
      allocatedHoursAfter: summary.allocatedHours,
      utilizationPercent: summary.utilizationPercent,
      requestedBy: {
        id: allocation.requester.id,
        name: allocation.requester.displayName,
      },
      requestedAt: allocation.requestedAt.toISOString(),
    };
  }
}

function sortApprovalRows(
  rows: AllocationApprovalRowDto[],
  sortBy: QueryAllocationApprovalsDto['sortBy'],
  sortOrder: 'asc' | 'desc',
): AllocationApprovalRowDto[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  const field = sortBy ?? 'requestedAt';

  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'employeeName':
        cmp = a.employeeName.localeCompare(b.employeeName);
        break;
      case 'projectName':
        cmp = a.projectName.localeCompare(b.projectName);
        break;
      case 'requestedAt':
      default:
        cmp = a.requestedAt.localeCompare(b.requestedAt);
    }
    return cmp * dir;
  });
}
