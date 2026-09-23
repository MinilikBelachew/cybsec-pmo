import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetApproverDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class BudgetRevisionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  budgetId: string;

  @ApiProperty()
  revisedAmount: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ type: BudgetApproverDto, nullable: true })
  approver: BudgetApproverDto | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class BudgetLineItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  budgetId: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  planned: number;

  @ApiProperty()
  actual: number;

  @ApiProperty()
  createdAt: string;
}

export class BudgetSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  baselineAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  currentBudgetAmount: number | null;

  @ApiProperty()
  expectedCost: number;

  @ApiProperty()
  actualCost: number;

  @ApiProperty()
  variance: number;

  @ApiPropertyOptional({ nullable: true })
  variancePct: number | null;

  @ApiProperty()
  revenue: number;

  @ApiProperty()
  margin: number;

  @ApiPropertyOptional({ nullable: true })
  marginPct: number | null;

  @ApiProperty({ enum: ['budget', 'project_value', 'none'] })
  currencyBasis: 'budget' | 'project_value' | 'none';
}

export class BudgetAdjustmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  budgetId: string;

  @ApiPropertyOptional({ nullable: true })
  lineItemId: string | null;

  @ApiProperty()
  targetField: string;

  @ApiProperty()
  oldAmount: number;

  @ApiProperty()
  newAmount: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  requestedBy: string;

  @ApiPropertyOptional({ type: BudgetApproverDto, nullable: true })
  requester: BudgetApproverDto | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ type: BudgetApproverDto, nullable: true })
  approver: BudgetApproverDto | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class ProjectBudgetDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  budgetId: string | null;

  @ApiPropertyOptional({ nullable: true })
  baselineAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ type: BudgetApproverDto, nullable: true })
  approver: BudgetApproverDto | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdAt: string | null;

  @ApiProperty({ type: BudgetSummaryDto })
  summary: BudgetSummaryDto;

  @ApiProperty({ type: [BudgetRevisionDto] })
  revisions: BudgetRevisionDto[];

  @ApiProperty({ type: [BudgetLineItemDto] })
  lineItems: BudgetLineItemDto[];

  @ApiProperty({ type: [BudgetAdjustmentDto] })
  adjustments: BudgetAdjustmentDto[];

  @ApiPropertyOptional({
    description: 'Project commercial value (budget fallback when no baseline)',
    nullable: true,
  })
  projectValue: number | null;

  @ApiPropertyOptional({
    description: 'actual / expected * 100 when expected > 0',
    nullable: true,
  })
  adherencePct: number | null;
}

export class ResourceCostRowDto {
  @ApiPropertyOptional({ nullable: true })
  employeeId: string | null;

  @ApiPropertyOptional({ nullable: true })
  employeeName: string | null;

  @ApiPropertyOptional({ nullable: true })
  designation: string | null;

  @ApiPropertyOptional({ nullable: true })
  periodYear: number | null;

  @ApiPropertyOptional({ nullable: true })
  periodMonth: number | null;

  @ApiProperty()
  regularHours: number;

  @ApiProperty()
  overtimeHours: number;

  @ApiProperty()
  totalCost: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Present only when caller has financials.view_rates',
  })
  ratePerHour: number | null;
}

export class ResourceCostBreakdownDto {
  @ApiProperty({ enum: ['employee', 'month', 'detail'] })
  groupBy: 'employee' | 'month' | 'detail';

  @ApiProperty({
    description: 'True when response includes ratePerHour values',
  })
  includeRates: boolean;

  @ApiProperty({ type: [ResourceCostRowDto] })
  rows: ResourceCostRowDto[];
}

export class PortfolioBudgetRowDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  budgetId: string | null;

  @ApiPropertyOptional({ nullable: true })
  baselineAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  currentBudgetAmount: number | null;

  @ApiProperty()
  expectedCost: number;

  @ApiProperty()
  actualCost: number;

  @ApiProperty()
  variance: number;

  @ApiPropertyOptional({ nullable: true })
  variancePct: number | null;

  @ApiProperty()
  revenue: number;

  @ApiProperty()
  margin: number;

  @ApiPropertyOptional({ nullable: true })
  marginPct: number | null;

  @ApiPropertyOptional({ nullable: true })
  adherencePct: number | null;

  @ApiProperty()
  overrun: boolean;
}
