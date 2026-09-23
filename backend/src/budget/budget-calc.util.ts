import { Prisma } from '@prisma/client';

export type BudgetAmountInputs = {
  baselineAmount: number | null;
  /** Latest approved revision amount, if any. */
  approvedRevisionAmount: number | null;
  /** Sum of BudgetLineItem.planned */
  plannedLineTotal: number;
  /** Sum of EmployeeCost.totalCost for the project */
  employeeCostTotal: number;
  /** Sum of BudgetLineItem.actual (all categories) */
  lineItemActualTotal: number;
  /** Sum of non-resource BudgetLineItem.actual */
  otherActualTotal: number;
  /** Contract / commercial value fallback when no ProjectBudget exists */
  projectValue: number | null;
  /** Sum of Invoice.amount when available (optional revenue) */
  invoiceTotal: number;
};

export type BudgetAmounts = {
  baselineAmount: number | null;
  currentBudgetAmount: number | null;
  expectedCost: number;
  actualCost: number;
  variance: number;
  variancePct: number | null;
  revenue: number;
  margin: number;
  marginPct: number | null;
  currencyBasis: 'budget' | 'project_value' | 'none';
};

function toNum(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Single source of truth for expected / actual / margin used by budget APIs
 * and (later) dashboard / health / status-report consumers.
 *
 * Actual cost prefers EmployeeCost when present, plus non-resource line actuals;
 * otherwise falls back to all line-item actuals.
 */
export function computeBudgetAmounts(input: BudgetAmountInputs): BudgetAmounts {
  const hasBudget =
    input.baselineAmount != null || input.approvedRevisionAmount != null;

  let currentBudgetAmount: number | null = null;
  let currencyBasis: BudgetAmounts['currencyBasis'] = 'none';

  if (input.approvedRevisionAmount != null) {
    currentBudgetAmount = input.approvedRevisionAmount;
    currencyBasis = 'budget';
  } else if (input.baselineAmount != null) {
    currentBudgetAmount = input.baselineAmount;
    currencyBasis = 'budget';
  } else if (input.projectValue != null && input.projectValue > 0) {
    currentBudgetAmount = input.projectValue;
    currencyBasis = 'project_value';
  }

  const expectedFromLines =
    input.plannedLineTotal > 0 ? input.plannedLineTotal : null;
  const expectedCost =
    currentBudgetAmount != null
      ? currentBudgetAmount
      : (expectedFromLines ?? 0);

  const actualCost =
    input.employeeCostTotal > 0
      ? input.employeeCostTotal + input.otherActualTotal
      : input.lineItemActualTotal;

  const variance = expectedCost - actualCost;
  const variancePct =
    expectedCost > 0 ? Math.round((variance / expectedCost) * 10000) / 100 : null;

  const revenue =
    input.invoiceTotal > 0
      ? input.invoiceTotal
      : input.projectValue != null && input.projectValue > 0
        ? input.projectValue
        : 0;
  const margin = revenue - actualCost;
  const marginPct =
    revenue > 0 ? Math.round((margin / revenue) * 10000) / 100 : null;

  return {
    baselineAmount: input.baselineAmount,
    currentBudgetAmount,
    expectedCost,
    actualCost,
    variance,
    variancePct,
    revenue,
    margin,
    marginPct,
    currencyBasis: hasBudget ? 'budget' : currencyBasis,
  };
}

export function sumDecimals(
  values: Array<Prisma.Decimal | number | null | undefined>,
): number {
  return values.reduce<number>((acc, v) => acc + toNum(v), 0);
}
