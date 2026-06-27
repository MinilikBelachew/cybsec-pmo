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
  budgetSpent?: number;
  budgetRemaining?: number;
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

export interface CreateProjectBundleDto extends CreateProjectDto {
  allocations?: CreateProjectTeamPayload["allocations"];
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

export interface TeamCandidate {
  employeeId: string;
  name: string;
  email: string;
  designation: string;
  userId: string | null;
  department: Pick<Department, "id" | "code" | "name">;
  weeklyCapacityHours: number;
  allocatedHoursOtherProjects: number;
  allocatedHoursThisProject: number;
  allocatedHoursTotal: number;
  remainingHours: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
  isFullyBooked: boolean;
  isOnProject: boolean;
}

export interface ProjectAllocation {
  id: string;
  projectId: string;
  employeeId: string;
  role: string;
  hours: number | null;
  percent: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  employee: {
    id: string;
    name: string;
    email: string;
    designation: string;
    userId: string | null;
    department: Pick<Department, "id" | "code" | "name">;
  };
  weeklyCapacityHours: number;
  allocatedHoursTotal: number;
  remainingHoursTotal: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
}

export interface PendingTeamMember {
  employeeId: string;
  name: string;
  departmentName: string;
  designation: string;
  role: string;
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
  remainingHours: number;
  isOverAllocated?: boolean;
}

export interface GetTeamCandidatesParams {
  departmentId?: string;
  projectId?: string;
}

export interface CreateProjectTeamPayload {
  allocations: Array<{
    employeeId: string;
    role: string;
    hours?: number;
    percent?: number;
    startDate: string;
    endDate?: string;
  }>;
}

export interface CreateProjectTeamResult {
  created: ProjectAllocation[];
  warnings: string[];
}

export interface ProjectTaskAssignee {
  userId: string;
  displayName: string;
  email: string;
  employeeId: string;
  name: string;
  designation: string;
  role: string;
  department: Pick<Department, "id" | "code" | "name">;
}
