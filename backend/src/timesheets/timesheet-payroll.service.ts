import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CostFormulaService } from '../settings/cost-formula.service';
import { TIMESHEET_STATUS } from './timesheets.constants';

type ApprovedEntry = {
  id: string;
  employeeId: string;
  projectId: string;
  workDate: Date;
  regularHours: Prisma.Decimal | number;
  overtimeHours: Prisma.Decimal | number;
};

const DEFAULT_RATE_PER_HOUR = 0;
const BACKFILL_BATCH = 500;

@Injectable()
export class TimesheetPayrollService {
  private readonly logger = new Logger(TimesheetPayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly costFormula: CostFormulaService,
  ) {}

  /**
   * Record approved timesheets into EmployeeCost idempotently (one ledger row
   * per timesheetId). Rate prefers allocation billing role rate, else
   * Keka-synced EmployeeSalary + cost formula.
   */
  async recordApprovedEntries(entries: ApprovedEntry[]): Promise<number> {
    if (!entries.length) return 0;

    const formula = await this.costFormula.getFormula();
    const now = new Date();
    let recorded = 0;

    const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, weeklyHours: true },
    });
    const weeklyHoursByEmployee = new Map(
      employees.map((e) => [e.id, Number(e.weeklyHours) || 0]),
    );

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

      const rate = await this.resolveRatePerHour(
        entry.employeeId,
        entry.projectId,
        entry.workDate,
        weeklyHoursByEmployee.get(entry.employeeId) ?? 0,
        formula,
      );

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

  /**
   * Fill EmployeeCost for Approved timesheets that have no ledger row yet
   * (e.g. approved before payroll wiring, or after salary sync arrived late).
   */
  async backfillMissingApprovedCosts(options?: {
    projectId?: string;
    employeeIds?: string[];
    limit?: number;
  }): Promise<number> {
    const limit = options?.limit ?? BACKFILL_BATCH;
    const entries = await this.prisma.timesheet.findMany({
      where: {
        status: TIMESHEET_STATUS.APPROVED,
        costLedger: null,
        ...(options?.projectId ? { projectId: options.projectId } : {}),
        ...(options?.employeeIds?.length
          ? { employeeId: { in: options.employeeIds } }
          : {}),
      },
      select: {
        id: true,
        employeeId: true,
        projectId: true,
        workDate: true,
        regularHours: true,
        overtimeHours: true,
      },
      orderBy: { workDate: 'asc' },
      take: limit,
    });

    if (!entries.length) return 0;
    const recorded = await this.recordApprovedEntries(entries);
    if (recorded > 0) {
      this.logger.log(
        `Backfilled ${recorded} approved timesheet cost ledger row(s)` +
          (options?.projectId ? ` for project ${options.projectId}` : ''),
      );
    }
    return recorded;
  }

  /**
   * Rebuild EmployeeCost for employees after Keka salary rates change.
   * Deletes existing cost rows (cascades ledger) then re-applies Approved hours.
   */
  async rebuildCostsForEmployees(employeeIds: string[]): Promise<number> {
    const unique = [...new Set(employeeIds.filter(Boolean))];
    if (!unique.length) return 0;

    await this.prisma.employeeCost.deleteMany({
      where: { employeeId: { in: unique } },
    });

    const entries = await this.prisma.timesheet.findMany({
      where: {
        status: TIMESHEET_STATUS.APPROVED,
        employeeId: { in: unique },
      },
      select: {
        id: true,
        employeeId: true,
        projectId: true,
        workDate: true,
        regularHours: true,
        overtimeHours: true,
      },
      orderBy: { workDate: 'asc' },
    });

    const recorded = await this.recordApprovedEntries(entries);
    this.logger.log(
      `Rebuilt resource costs for ${unique.length} employee(s): ${recorded} ledger row(s)`,
    );
    return recorded;
  }

  /**
   * Ensure a project has EmployeeCost rows for all Approved timesheets.
   * Used when opening Resource cost breakdown.
   */
  async ensureProjectResourceCosts(projectId: string): Promise<number> {
    const missing = await this.backfillMissingApprovedCosts({
      projectId,
      limit: BACKFILL_BATCH,
    });

    // If ledger exists at $0 but current Keka salary now has a rate, rebuild
    // those employees so Financials reflects salary sync.
    const zeroRateCosts = await this.prisma.employeeCost.findMany({
      where: {
        projectId,
        entries: { some: { ratePerHour: 0 } },
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
      take: 100,
    });

    const employeeIds = zeroRateCosts.map((r) => r.employeeId);
    if (!employeeIds.length) return missing;

    const withSalary = await this.prisma.employeeSalary.findMany({
      where: {
        employeeId: { in: employeeIds },
        isCurrent: true,
        OR: [
          { ratePerHour: { gt: 0 } },
          { ctc: { gt: 0 } },
          { gross: { gt: 0 } },
        ],
      },
      select: { employeeId: true },
    });

    const rebuildIds = [...new Set(withSalary.map((s) => s.employeeId))];
    if (!rebuildIds.length) return missing;

    const rebuilt = await this.rebuildCostsForEmployees(rebuildIds);
    return missing + rebuilt;
  }

  private async resolveRatePerHour(
    employeeId: string,
    projectId: string,
    workDate: Date,
    weeklyHours: number,
    formula: Awaited<ReturnType<CostFormulaService['getFormula']>>,
  ): Promise<number> {
    // Prefer Keka client billing role rate stored on the overlapping allocation.
    const allocation = await this.prisma.allocation.findFirst({
      where: {
        employeeId,
        projectId,
        status: { in: ['Active', 'Pending'] },
        billingRate: { not: null, gt: 0 },
        startDate: { lte: workDate },
        OR: [{ endDate: null }, { endDate: { gte: workDate } }],
      },
      orderBy: { startDate: 'desc' },
      select: { billingRate: true },
    });
    if (allocation?.billingRate != null) {
      const billingRate = Number(allocation.billingRate);
      if (billingRate > 0) return billingRate;
    }

    // Prefer salary effective on the work date (Keka history), else current.
    let salary = await this.prisma.employeeSalary.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: workDate },
      },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        ratePerHour: true,
        ctc: true,
        gross: true,
        remunerationType: true,
      },
    });

    if (!salary) {
      salary = await this.prisma.employeeSalary.findFirst({
        where: { employeeId, isCurrent: true },
        orderBy: { effectiveFrom: 'desc' },
        select: {
          ratePerHour: true,
          ctc: true,
          gross: true,
          remunerationType: true,
        },
      });
    }

    if (!salary) return DEFAULT_RATE_PER_HOUR;

    let rate = Number(salary.ratePerHour ?? DEFAULT_RATE_PER_HOUR);
    if (rate > 0) return rate;

    const amount =
      formula.basis === 'gross' ? Number(salary.gross) : Number(salary.ctc);
    const derived = this.costFormula.deriveRatePerHour(
      amount,
      salary.remunerationType,
      {
        ...formula,
        hoursPerWeek: weeklyHours > 0 ? weeklyHours : formula.hoursPerWeek,
      },
    );
    return derived ? Number(derived) : DEFAULT_RATE_PER_HOUR;
  }
}
