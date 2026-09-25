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

  @ApiPropertyOptional({
    nullable: true,
    description: 'Keka employee number when synced',
  })
  employeeNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  designation: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Keka-synced department name',
  })
  departmentName: string | null;

  @ApiPropertyOptional({
    description: 'True when a current Keka EmployeeSalary with rate exists',
  })
  hasSalaryRate: boolean;

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

export class ProjectInvoiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  zohoInvoiceId: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiPropertyOptional({ nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectName: string | null;

  @ApiPropertyOptional({ nullable: true })
  matchedMilestoneId: string | null;

  @ApiPropertyOptional({ nullable: true })
  milestoneTitle: string | null;

  @ApiProperty()
  amount: string;

  @ApiPropertyOptional({ nullable: true })
  balance: string | null;

  @ApiPropertyOptional({ nullable: true })
  paymentMade: string | null;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  invoiceDate: string | null;

  @ApiProperty()
  dueDate: string;

  @ApiPropertyOptional({ nullable: true })
  collectionDate: string | null;

  @ApiProperty({
    description: 'Raw Zoho Books status (lowercased)',
  })
  status: string;

  @ApiProperty({
    description: 'Normalized payment state for UI',
    enum: ['paid', 'unpaid', 'overdue', 'partial', 'other'],
  })
  paymentStatus: 'paid' | 'unpaid' | 'overdue' | 'partial' | 'other';

  @ApiPropertyOptional({ nullable: true })
  discrepancyNote: string | null;

  @ApiProperty()
  syncedAt: string;
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
