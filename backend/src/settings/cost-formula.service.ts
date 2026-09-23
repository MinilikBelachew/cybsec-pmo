import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppSettingsService } from './app-settings.service';
import {
  COST_FORMULA_LIMITS,
  CostFormulaConfig,
  DEFAULT_COST_FORMULA,
} from './cost-formula.constants';

@Injectable()
export class CostFormulaService {
  private cache: { value: CostFormulaConfig; at: number } | null = null;
  private readonly ttlMs = 30_000;

  constructor(private readonly appSettingsService: AppSettingsService) {}

  async getFormula(): Promise<CostFormulaConfig> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.value;
    }
    try {
      const { formula } = await this.appSettingsService.getCostFormula();
      this.cache = { value: formula, at: Date.now() };
      return formula;
    } catch {
      return { ...DEFAULT_COST_FORMULA };
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Derive hourly rate from compensation using the approved formula.
   * monthlyRemunerationType matches Keka: treat that value as monthly, else annual.
   */
  deriveRatePerHour(
    amount: number,
    remunerationType: number | null | undefined,
    formula: CostFormulaConfig = DEFAULT_COST_FORMULA,
  ): Prisma.Decimal | null {
    if (!amount || amount <= 0) return null;
    const hoursPerYear = formula.hoursPerWeek * formula.weeksPerYear;
    if (hoursPerYear <= 0) return null;

    const annual =
      remunerationType === formula.monthlyRemunerationType
        ? amount * 12
        : amount;
    return new Prisma.Decimal((annual / hoursPerYear).toFixed(4));
  }

  computeLineCost(
    regularHours: number,
    overtimeHours: number,
    ratePerHour: number,
    formula: CostFormulaConfig,
  ): number {
    const ot = formula.otMultiplier > 0 ? formula.otMultiplier : 1;
    return regularHours * ratePerHour + overtimeHours * ratePerHour * ot;
  }

  assertValid(partial: Partial<CostFormulaConfig>): void {
    const hours =
      partial.hoursPerWeek ?? DEFAULT_COST_FORMULA.hoursPerWeek;
    const weeks =
      partial.weeksPerYear ?? DEFAULT_COST_FORMULA.weeksPerYear;
    const ot = partial.otMultiplier ?? DEFAULT_COST_FORMULA.otMultiplier;

    if (
      hours < COST_FORMULA_LIMITS.hoursPerWeek.min ||
      hours > COST_FORMULA_LIMITS.hoursPerWeek.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { hoursPerWeek: 'hoursPerWeekOutOfRange' },
      });
    }
    if (
      weeks < COST_FORMULA_LIMITS.weeksPerYear.min ||
      weeks > COST_FORMULA_LIMITS.weeksPerYear.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { weeksPerYear: 'weeksPerYearOutOfRange' },
      });
    }
    if (
      ot < COST_FORMULA_LIMITS.otMultiplier.min ||
      ot > COST_FORMULA_LIMITS.otMultiplier.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { otMultiplier: 'otMultiplierOutOfRange' },
      });
    }
    if (
      partial.basis != null &&
      partial.basis !== 'ctc' &&
      partial.basis !== 'gross'
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { basis: 'invalidBasis' },
      });
    }
  }
}
