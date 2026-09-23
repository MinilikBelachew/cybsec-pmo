import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CostFormulaService } from '../settings/cost-formula.service';

type ApprovedEntry = {
  id: string;
  employeeId: string;
  projectId: string;
  workDate: Date;
  regularHours: Prisma.Decimal;
  overtimeHours: Prisma.Decimal;
};

const DEFAULT_RATE_PER_HOUR = 0;

@Injectable()
export class TimesheetPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costFormula: CostFormulaService,
  ) {}

  /**
   * Record approved timesheets into EmployeeCost idempotently (one ledger row
   * per timesheetId). Applies approved cost formula OT multiplier.
   */
  async recordApprovedEntries(entries: ApprovedEntry[]): Promise<number> {
    const formula = await this.costFormula.getFormula();
    const now = new Date();
    let recorded = 0;

    for (const entry of entries) {
      const existingLedger = await this.prisma.employeeCostTimesheet.findUnique({
        where: { timesheetId: entry.id },
        select: { id: true },
      });
      if (existingLedger) {
        continue;
      }

      const periodYear = entry.workDate.getUTCFullYear();
      const periodMonth = entry.workDate.getUTCMonth() + 1;
      const regular = Number(entry.regularHours);
      const overtime = Number(entry.overtimeHours);

      const salary = await this.prisma.employeeSalary.findFirst({
        where: { employeeId: entry.employeeId, isCurrent: true },
        orderBy: { effectiveFrom: 'desc' },
        select: { ratePerHour: true, ctc: true, gross: true, remunerationType: true },
      });

      let rate = Number(salary?.ratePerHour ?? DEFAULT_RATE_PER_HOUR);
      if ((!rate || rate <= 0) && salary) {
        const amount =
          formula.basis === 'gross'
            ? Number(salary.gross)
            : Number(salary.ctc);
        const derived = this.costFormula.deriveRatePerHour(
          amount,
          salary.remunerationType,
          formula,
        );
        rate = derived ? Number(derived) : 0;
      }

      const lineCost = this.costFormula.computeLineCost(
        regular,
        overtime,
        rate,
        formula,
      );

      await this.prisma.$transaction(async (tx) => {
        const again = await tx.employeeCostTimesheet.findUnique({
          where: { timesheetId: entry.id },
          select: { id: true },
        });
        if (again) return;

        let cost = await tx.employeeCost.findUnique({
          where: {
            employeeId_projectId_periodYear_periodMonth: {
              employeeId: entry.employeeId,
              projectId: entry.projectId,
              periodYear,
              periodMonth,
            },
          },
        });

        if (!cost) {
          cost = await tx.employeeCost.create({
            data: {
              employeeId: entry.employeeId,
              projectId: entry.projectId,
              periodYear,
              periodMonth,
              ratePerHour: rate,
              regularHours: regular,
              overtimeHours: overtime,
              totalCost: lineCost,
              computedAt: now,
            },
          });
        } else {
          const nextRegular = Number(cost.regularHours) + regular;
          const nextOvertime = Number(cost.overtimeHours) + overtime;
          const nextTotal = Number(cost.totalCost) + lineCost;
          cost = await tx.employeeCost.update({
            where: { id: cost.id },
            data: {
              regularHours: nextRegular,
              overtimeHours: nextOvertime,
              totalCost: nextTotal,
              // Keep first rate as period rate; ledger stores per-entry rate.
              computedAt: now,
            },
          });
        }

        await tx.employeeCostTimesheet.create({
          data: {
            employeeCostId: cost.id,
            timesheetId: entry.id,
            regularHours: regular,
            overtimeHours: overtime,
            ratePerHour: rate,
            otMultiplier: formula.otMultiplier,
            lineCost,
          },
        });
      });

      recorded += 1;
    }

    return recorded;
  }
}
