import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { KekaEmployeeSalary, KekaPayCycle, KekaPayGroup } from '../keka.types';

export type SalarySyncResult = {
  synced: number;
  failed: number;
};

@Injectable()
export class SalarySyncService {
  private readonly logger = new Logger(SalarySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async syncSalariesAndPayCycles(): Promise<SalarySyncResult> {
    const payCycleResult = await this.syncPayCycles();
    const salaryResult = await this.syncSalaries();
    return {
      synced: payCycleResult.synced + salaryResult.synced,
      failed: payCycleResult.failed + salaryResult.failed,
    };
  }

  async syncPayCycles(): Promise<SalarySyncResult> {
    let payGroups: KekaPayGroup[];
    try {
      payGroups = await this.kekaClient.getAllPages<KekaPayGroup>(
        '/payroll/paygroups',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Pay group API request failed';
      this.logger.error(`Pay group fetch failed: ${message}`);
      await this.logFailure(
        KEKA_ENTITY_TYPE.PAY_CYCLE,
        'paygroups-batch',
        {},
        message,
      );
      return { synced: 0, failed: 1 };
    }

    if (payGroups.length === 0) {
      this.logger.log('Pay cycle sync: Keka returned 0 pay groups');
      await this.logSuccess(KEKA_ENTITY_TYPE.PAY_CYCLE, 'paygroups-empty', {
        totalRecords: 0,
      });
      return { synced: 0, failed: 0 };
    }

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;

    for (const payGroup of payGroups) {
      // Pay cycles API requires payGroupId as UUID → use identifier, not numeric id.
      const payGroupId = payGroup.identifier?.trim();
      if (!payGroupId) {
        failed += 1;
        await this.logFailure(
          KEKA_ENTITY_TYPE.PAY_CYCLE,
          String(payGroup.id ?? 'unknown'),
          payGroup,
          'Pay group is missing identifier (UUID)',
        );
        continue;
      }

      let cycles: KekaPayCycle[];
      try {
        // Prefer path form — query-only /paygroups/paycycles returns
        // "PayGroup ID is required" on this tenant when the UUID is omitted/wrong.
        cycles = await this.kekaClient.getAllPages<KekaPayCycle>(
          `/payroll/paygroups/${encodeURIComponent(payGroupId)}/paycycles`,
        );
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error
            ? error.message
            : 'Pay cycle API request failed';
        this.logger.error(
          `Pay cycle fetch failed for payGroup ${payGroupId}: ${message}`,
        );
        await this.logFailure(
          KEKA_ENTITY_TYPE.PAY_CYCLE,
          payGroupId,
          { payGroupId },
          message,
        );
        continue;
      }

      for (const cycle of cycles) {
        const identifier = cycle.identifier?.trim();
        if (!identifier) {
          failed += 1;
          await this.logFailure(
            KEKA_ENTITY_TYPE.PAY_CYCLE,
            'unknown',
            cycle,
            'Pay cycle is missing identifier',
          );
          continue;
        }

        try {
          const { periodYear, periodMonth } = this.parsePeriod(cycle.month);
          await this.prisma.kekaPayCycle.upsert({
            where: { kekaIdentifier: identifier },
            update: {
              kekaPayGroupId: payGroupId,
              monthLabel: cycle.month?.trim() || null,
              periodYear,
              periodMonth,
              startDate: this.toDateOnly(cycle.startDate),
              endDate: this.toDateOnly(cycle.endDate),
              runStatus: cycle.runStatus ?? null,
              syncedAt,
            },
            create: {
              kekaIdentifier: identifier,
              kekaPayGroupId: payGroupId,
              monthLabel: cycle.month?.trim() || null,
              periodYear,
              periodMonth,
              startDate: this.toDateOnly(cycle.startDate),
              endDate: this.toDateOnly(cycle.endDate),
              runStatus: cycle.runStatus ?? null,
              syncedAt,
            },
          });

          await this.logSuccess(KEKA_ENTITY_TYPE.PAY_CYCLE, identifier, {
            ...cycle,
            payGroupId,
          });
          synced += 1;
        } catch (error) {
          failed += 1;
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown pay cycle sync error';
          this.logger.warn(
            `Pay cycle sync failed for ${identifier}: ${message}`,
          );
          await this.logFailure(
            KEKA_ENTITY_TYPE.PAY_CYCLE,
            identifier,
            cycle,
            message,
          );
        }
      }
    }

    if (synced === 0 && failed === 0) {
      await this.logSuccess(KEKA_ENTITY_TYPE.PAY_CYCLE, 'batch-empty', {
        payGroupCount: payGroups.length,
        totalRecords: 0,
      });
    }

    return { synced, failed };
  }

  async syncSalaries(): Promise<SalarySyncResult> {
    let salaries: KekaEmployeeSalary[];
    try {
      salaries = await this.fetchSalaries();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Salary API request failed';
      this.logger.error(`Salary fetch failed: ${message}`);
      await this.logFailure(KEKA_ENTITY_TYPE.SALARY, 'batch', {}, message);
      return { synced: 0, failed: 1 };
    }

    if (salaries.length === 0) {
      this.logger.log('Salary sync: Keka returned 0 salary records');
      await this.logSuccess(KEKA_ENTITY_TYPE.SALARY, 'batch-empty', {
        totalRecords: 0,
      });
      return { synced: 0, failed: 0 };
    }

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;

    for (const salary of salaries) {
      const kekaSalaryId = salary.id?.trim() ?? 'unknown';

      try {
        const kekaEmployeeId = salary.employee?.id?.trim();
        if (!kekaEmployeeId) {
          throw new Error('Salary record is missing employee.id');
        }
        if (!salary.id?.trim()) {
          throw new Error('Salary record is missing id');
        }

        const employee = await this.prisma.employee.findUnique({
          where: { kekaEmployeeId },
          select: { id: true, weeklyHours: true },
        });
        if (!employee) {
          throw new Error(`No local employee for Keka id ${kekaEmployeeId}`);
        }

        const effectiveFrom = this.toDateOnly(salary.effectiveFrom);
        if (!effectiveFrom) {
          throw new Error('Salary record is missing effectiveFrom');
        }

        const ratePerHour = this.deriveRatePerHour(
          salary.ctc,
          salary.remunerationType,
          Number(employee.weeklyHours),
        );

        await this.prisma.employeeSalary.updateMany({
          where: {
            employeeId: employee.id,
            isCurrent: true,
            NOT: { kekaSalaryId: salary.id.trim() },
          },
          data: { isCurrent: false },
        });

        await this.prisma.employeeSalary.upsert({
          where: { kekaSalaryId: salary.id.trim() },
          update: {
            employeeId: employee.id,
            kekaEmployeeId,
            ctc: new Prisma.Decimal(salary.ctc),
            gross: new Prisma.Decimal(salary.gross),
            netPay: new Prisma.Decimal(salary.netPay),
            remunerationType: salary.remunerationType ?? null,
            effectiveFrom,
            ratePerHour,
            isCurrent: true,
            earnings:
              salary.earnings == null
                ? Prisma.JsonNull
                : (salary.earnings as Prisma.InputJsonValue),
            contributions:
              salary.contributions == null
                ? Prisma.JsonNull
                : (salary.contributions as Prisma.InputJsonValue),
            deductions:
              salary.deductions == null
                ? Prisma.JsonNull
                : (salary.deductions as Prisma.InputJsonValue),
            variables:
              salary.variables == null
                ? Prisma.JsonNull
                : (salary.variables as Prisma.InputJsonValue),
            syncedAt,
          },
          create: {
            employeeId: employee.id,
            kekaSalaryId: salary.id.trim(),
            kekaEmployeeId,
            ctc: new Prisma.Decimal(salary.ctc),
            gross: new Prisma.Decimal(salary.gross),
            netPay: new Prisma.Decimal(salary.netPay),
            remunerationType: salary.remunerationType ?? null,
            effectiveFrom,
            ratePerHour,
            isCurrent: true,
            earnings:
              salary.earnings == null
                ? Prisma.JsonNull
                : (salary.earnings as Prisma.InputJsonValue),
            contributions:
              salary.contributions == null
                ? Prisma.JsonNull
                : (salary.contributions as Prisma.InputJsonValue),
            deductions:
              salary.deductions == null
                ? Prisma.JsonNull
                : (salary.deductions as Prisma.InputJsonValue),
            variables:
              salary.variables == null
                ? Prisma.JsonNull
                : (salary.variables as Prisma.InputJsonValue),
            syncedAt,
          },
        });

        await this.logSuccess(KEKA_ENTITY_TYPE.SALARY, kekaSalaryId, salary);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown salary sync error';
        this.logger.warn(`Salary sync failed for ${kekaSalaryId}: ${message}`);
        await this.logFailure(
          KEKA_ENTITY_TYPE.SALARY,
          kekaSalaryId,
          salary,
          message,
        );
      }
    }

    return { synced, failed };
  }

  /**
   * Prefer pay-group scoped fetches — unscoped /payroll/salaries often
   * returns empty on sandbox tenants even when pay groups exist.
   */
  private async fetchSalaries(): Promise<KekaEmployeeSalary[]> {
    const payGroupIds = await this.resolvePayGroupIds();
    const byId = new Map<string, KekaEmployeeSalary>();

    if (payGroupIds.length > 0) {
      for (const payGroupId of payGroupIds) {
        const page = await this.kekaClient.getAllPages<KekaEmployeeSalary>(
          '/payroll/salaries',
          {
            paygroupIds: payGroupId,
            employmentStatus: 'Working,Relieved',
          },
        );
        for (const row of page) {
          const key = row.id?.trim() || `${row.employee?.id}:${row.effectiveFrom}`;
          if (key) {
            byId.set(key, row);
          }
        }
      }

      if (byId.size > 0) {
        return [...byId.values()];
      }
    }

    // Fallback: unscoped list (production tenants often return all here).
    return this.kekaClient.getAllPages<KekaEmployeeSalary>('/payroll/salaries', {
      employmentStatus: 'Working,Relieved',
    });
  }

  private async resolvePayGroupIds(): Promise<string[]> {
    const fromDb = await this.prisma.kekaPayCycle.findMany({
      where: { kekaPayGroupId: { not: null } },
      distinct: ['kekaPayGroupId'],
      select: { kekaPayGroupId: true },
    });
    const ids = fromDb
      .map((row) => row.kekaPayGroupId?.trim())
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      return ids;
    }

    const payGroups = await this.kekaClient.getAllPages<KekaPayGroup>(
      '/payroll/paygroups',
    );
    return payGroups
      .map((g) => g.identifier?.trim())
      .filter((id): id is string => Boolean(id));
  }

  /**
   * Derive hourly rate from CTC.
   * RemunerationType is tenant-specific; treat 1 as monthly, everything else as annual.
   */
  private deriveRatePerHour(
    ctc: number,
    remunerationType: number | null | undefined,
    weeklyHours: number,
  ): Prisma.Decimal | null {
    if (!ctc || !weeklyHours || weeklyHours <= 0) {
      return null;
    }

    const annual =
      remunerationType === 1 ? ctc * 12 : ctc;
    const hoursPerYear = weeklyHours * 52;
    if (hoursPerYear <= 0) {
      return null;
    }

    return new Prisma.Decimal((annual / hoursPerYear).toFixed(4));
  }

  private parsePeriod(monthLabel?: string | null): {
    periodYear: number | null;
    periodMonth: number | null;
  } {
    if (!monthLabel?.trim()) {
      return { periodYear: null, periodMonth: null };
    }

    const parsed = new Date(monthLabel);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        periodYear: parsed.getUTCFullYear(),
        periodMonth: parsed.getUTCMonth() + 1,
      };
    }

    const match = monthLabel.match(/(\d{4}).*?(\d{1,2})|(\d{1,2}).*?(\d{4})/);
    if (!match) {
      return { periodYear: null, periodMonth: null };
    }

    if (match[1] && match[2]) {
      return {
        periodYear: Number(match[1]),
        periodMonth: Number(match[2]),
      };
    }

    return {
      periodYear: Number(match[4]),
      periodMonth: Number(match[3]),
    };
  }

  private toDateOnly(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private async logSuccess(
    entityType: string,
    entityId: string,
    payload: unknown,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async logFailure(
    entityType: string,
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });
  }
}
