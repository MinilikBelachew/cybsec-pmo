export type BudgetApprover = {
  id: string;
  displayName: string;
  email: string;
};

export type BudgetRevision = {
  id: string;
  budgetId: string;
  revisedAmount: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  approvedBy: string | null;
  approver: BudgetApprover | null;
  approvedAt: string | null;
  createdAt: string;
};

export type BudgetLineItem = {
  id: string;
  budgetId: string;
  category: string;
  itemName: string;
  planned: number;
  actual: number;
  createdAt: string;
};

export type BudgetSummary = {
  baselineAmount: number | null;
  currentBudgetAmount: number | null;
  expectedCost: number;
  actualCost: number;
  variance: number;
  variancePct: number | null;
  revenue: number;
  margin: number;
  marginPct: number | null;
  currencyBasis: "budget" | "project_value" | "none";
};

export type ProjectBudget = {
  projectId: string;
  currency: string;
  budgetId: string | null;
  baselineAmount: number | null;
  approvedBy: string | null;
  approver: BudgetApprover | null;
  approvedAt: string | null;
  createdAt: string | null;
  summary: BudgetSummary;
  revisions: BudgetRevision[];
  lineItems: BudgetLineItem[];
  adjustments: BudgetAdjustment[];
  projectValue: number | null;
  adherencePct: number | null;
};

export type BudgetAdjustment = {
  id: string;
  budgetId: string;
  lineItemId: string | null;
  targetField: string;
  oldAmount: number;
  newAmount: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  requestedBy: string;
  requester: BudgetApprover | null;
  approvedBy: string | null;
  approver: BudgetApprover | null;
  approvedAt: string | null;
  createdAt: string;
};

export type PortfolioBudgetRow = {
  projectId: string;
  projectName: string;
  currency: string;
  budgetId: string | null;
  baselineAmount: number | null;
  currentBudgetAmount: number | null;
  expectedCost: number;
  actualCost: number;
  variance: number;
  variancePct: number | null;
  revenue: number;
  margin: number;
  marginPct: number | null;
  adherencePct: number | null;
  overrun: boolean;
};

export type CreateBudgetBaselinePayload = {
  amount: number;
  currency?: string;
};

export type CreateBudgetRevisionPayload = {
  revisedAmount: number;
  reason: string;
};

export type CreateBudgetLineItemPayload = {
  category: string;
  itemName: string;
  planned: number;
  actual?: number;
};

export type UpdateBudgetLineItemPayload = {
  category?: string;
  itemName?: string;
  planned?: number;
  actual?: number;
};

export type CreateBudgetAdjustmentPayload = {
  targetField: "LineActual" | "LinePlanned" | "Baseline" | string;
  lineItemId?: string;
  newAmount: number;
  reason: string;
};

export type ResourceCostRow = {
  employeeId: string | null;
  employeeName: string | null;
  employeeNumber: string | null;
  designation: string | null;
  departmentName: string | null;
  hasSalaryRate: boolean;
  periodYear: number | null;
  periodMonth: number | null;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
  ratePerHour: number | null;
};

export type ResourceCostBreakdown = {
  groupBy: "employee" | "month" | "detail";
  includeRates: boolean;
  rows: ResourceCostRow[];
};

export type InvoicePaymentStatus =
  | "paid"
  | "unpaid"
  | "overdue"
  | "partial"
  | "other";

export type ProjectInvoice = {
  id: string;
  zohoInvoiceId: string;
  invoiceNumber: string;
  customerName: string | null;
  projectId: string | null;
  projectName: string | null;
  matchedMilestoneId: string | null;
  milestoneTitle: string | null;
  amount: string;
  balance: string | null;
  paymentMade: string | null;
  currency: string;
  invoiceDate: string | null;
  dueDate: string;
  collectionDate: string | null;
  status: string;
  paymentStatus: InvoicePaymentStatus;
  discrepancyNote: string | null;
  syncedAt: string;
};

export const BUDGET_LINE_CATEGORIES = [
  "Resource",
  "Travel",
  "Software",
  "Subcontract",
  "Other",
] as const;
