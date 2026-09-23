export const DEFAULT_COST_FORMULA = {
  basis: 'ctc' as const,
  hoursPerWeek: 40,
  weeksPerYear: 52,
  otMultiplier: 1.5,
  leaveMode: 'ignore' as const,
  /** Keka remunerationType value treated as monthly CTC. */
  monthlyRemunerationType: 1,
  version: 1,
};

export type CostFormulaBasis = 'ctc' | 'gross';
export type CostFormulaLeaveMode = 'ignore' | 'exclude_unpaid' | 'prorate';

export type CostFormulaConfig = {
  basis: CostFormulaBasis;
  hoursPerWeek: number;
  weeksPerYear: number;
  otMultiplier: number;
  leaveMode: CostFormulaLeaveMode;
  monthlyRemunerationType: number;
  version: number;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export const COST_FORMULA_LIMITS = {
  hoursPerWeek: { min: 1, max: 80 },
  weeksPerYear: { min: 1, max: 53 },
  otMultiplier: { min: 1, max: 3 },
} as const;
