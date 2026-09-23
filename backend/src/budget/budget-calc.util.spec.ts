import { computeBudgetAmounts } from './budget-calc.util';

describe('computeBudgetAmounts', () => {
  it('uses approved revision as current budget', () => {
    const result = computeBudgetAmounts({
      baselineAmount: 100_000,
      approvedRevisionAmount: 120_000,
      plannedLineTotal: 0,
      employeeCostTotal: 40_000,
      lineItemActualTotal: 5_000,
      otherActualTotal: 5_000,
      projectValue: 200_000,
      invoiceTotal: 0,
    });

    expect(result.currentBudgetAmount).toBe(120_000);
    expect(result.expectedCost).toBe(120_000);
    expect(result.actualCost).toBe(45_000);
    expect(result.revenue).toBe(200_000);
    expect(result.margin).toBe(155_000);
    expect(result.currencyBasis).toBe('budget');
  });

  it('falls back to project value when no budget row', () => {
    const result = computeBudgetAmounts({
      baselineAmount: null,
      approvedRevisionAmount: null,
      plannedLineTotal: 0,
      employeeCostTotal: 0,
      lineItemActualTotal: 10_000,
      otherActualTotal: 10_000,
      projectValue: 50_000,
      invoiceTotal: 0,
    });

    expect(result.currentBudgetAmount).toBe(50_000);
    expect(result.expectedCost).toBe(50_000);
    expect(result.actualCost).toBe(10_000);
    expect(result.currencyBasis).toBe('project_value');
  });

  it('prefers invoice total for revenue when present', () => {
    const result = computeBudgetAmounts({
      baselineAmount: 80_000,
      approvedRevisionAmount: null,
      plannedLineTotal: 0,
      employeeCostTotal: 0,
      lineItemActualTotal: 20_000,
      otherActualTotal: 20_000,
      projectValue: 100_000,
      invoiceTotal: 90_000,
    });

    expect(result.revenue).toBe(90_000);
    expect(result.margin).toBe(70_000);
  });
});
