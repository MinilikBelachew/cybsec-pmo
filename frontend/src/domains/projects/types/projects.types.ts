export type EngagementType = "ManagedServices" | "StaffAugmentation" | "FixedPrice";
export type Methodology = "Agile" | "Waterfall" | "Hybrid";
export type BillingModel = "TimeAndMaterial" | "FixedPrice" | "Retainer";
export type PriorityLevel = "Low" | "Medium" | "High" | "Critical";
export type ProjectStatus = "Draft" | "Active" | "OnHold" | "PendingClosure" | "Closed";
export type CurrencyCode = "USD" | "EUR" | "AED" | "SAR";

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Customer {
  id: string;
  displayName: string;
  industry?: string | null;
  status: string;
}

export interface ProjectManager {
  id: string;
  displayName: string;
  email: string;
  roleId: number;
  roleCode: string;
}

export interface Project {
  id: string;
  name: string;
  objective: string;
  departmentId: string;
  customerId: string;
  engagementType: EngagementType;
  methodology: Methodology;
  billingModel: BillingModel;
  priority: PriorityLevel;
  startDate: string;
  endDate: string;
  value: number;
  currency: CurrencyCode;
  primaryPmId: string;
  secondaryPmId: string | null;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  department?: Pick<Department, "id" | "code" | "name">;
  customer?: Pick<Customer, "id" | "displayName">;
  primaryPm?: Pick<ProjectManager, "id" | "displayName" | "email">;
  secondaryPm?: Pick<ProjectManager, "id" | "displayName" | "email"> | null;
  tasksTotal?: number;
  tasksDone?: number;
  phasesTotal?: number;
  phasesCompleted?: number;
  milestonesTotal?: number;
  milestonesDone?: number;
}

export interface GetProjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  priority?: PriorityLevel;
}

export interface ProjectPortfolioStats {
  total: number;
  active: number;
  atRisk: number;
  delayed: number;
  completed: number;
}

export interface CreateProjectDto {
  name: string;
  objective: string;
  departmentId: string;
  customerId: string;
  engagementType: EngagementType;
  methodology?: Methodology;
  billingModel: BillingModel;
  priority?: PriorityLevel;
  startDate: string;
  endDate: string;
  value: number;
  currency?: CurrencyCode;
  primaryPmId: string;
  secondaryPmId?: string | null;
  status?: ProjectStatus;
}

export interface PaginatedProjectsResponse {
  data: Project[];
  hasNextPage: boolean;
  stats?: ProjectPortfolioStats;
}

export type PhaseStatus = "Planned" | "Active" | "Completed" | "On_Hold";

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  orderIndex: number;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  createdAt: string;
  updatedAt: string;
  milestones?: ProjectMilestone[];
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  phaseId?: string | null;
  title: string;
  targetDate: string;
  weight?: number | null;
  status: string;
  createdAt: string;
  phase?: ProjectPhase | null;
}
