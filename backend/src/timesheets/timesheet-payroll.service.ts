import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type ApprovedEntry = {
  id: string;
  employeeId: string;
  projectId: string;
  workDate: Date;
  regularHours: Prisma.Decimal;
  overtimeHours: Prisma.Decimal;
};

/** Default rate when no finance rate is configured — hours are still recorded. */
const DEFAULT_RATE_PER_HOUR = 0;

@Injectable()
export class TimesheetPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async recordApprovedEntries(entries: ApprovedEntry[]): Promise<number> {
    const now = new Date();
    let recorded = 0;

    for (const entry of entries) {
      const periodYear = entry.workDate.getUTCFullYear();
      const periodMonth = entry.workDate.getUTCMonth() + 1;
      const regular = Number(entry.regularHours);
      const overtime = Number(entry.overtimeHours);

      const existing = await this.prisma.employeeCost.findUnique({
        where: {
          employeeId_projectId_periodYear_periodMonth: {
            employeeId: entry.employeeId,
            projectId: entry.projectId,
            periodYear,
            periodMonth,
          },
        },
      });

      if (existing) {
        const nextRegular = Number(existing.regularHours) + regular;
        const nextOvertime = Number(existing.overtimeHours) + overtime;
        const rate = Number(existing.ratePerHour);

        await this.prisma.employeeCost.update({
          where: { id: existing.id },
          data: {
            regularHours: nextRegular,
            overtimeHours: nextOvertime,
            totalCost: (nextRegular + nextOvertime) * rate,
            computedAt: now,
          },
        });
      } else {
        await this.prisma.employeeCost.create({
          data: {
            employeeId: entry.employeeId,
            projectId: entry.projectId,
            periodYear,
            periodMonth,
            ratePerHour: DEFAULT_RATE_PER_HOUR,
            regularHours: regular,
            overtimeHours: overtime,
            totalCost: 0,
            computedAt: now,
          },
        });
      }

      recorded += 1;
    }

    return recorded;
  }
}
