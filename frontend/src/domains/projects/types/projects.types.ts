export type EngagementType = "ManagedServices" | "StaffAugmentation" | "FixedPrice";
export type BillingModel = "TimeAndMaterial" | "FixedPrice" | "Retainer";
export type ProjectMethodology = "Agile" | "Waterfall" | "Hybrid";
export type PriorityLevel = "Low" | "Medium" | "High" | "Critical";
export type ProjectStatus =
  | "Draft"
  | "Active"
  | "OnHold"
  | "AtRisk"
  | "PendingClosure"
  | "Closed"
  | "Cancelled";
export type CurrencyCode = string;

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
}


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
  kekaClientId?: string | null;
  kekaClientCode?: string | null;
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
  engagementType?: EngagementType;
  billingModel?: BillingModel;
  methodology?: ProjectMethodology;
  priority: PriorityLevel;
  startDate: string;
  endDate: string;
  value?: number;
  currency?: CurrencyCode;
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
  kekaProjectId?: string | null;
  kekaClientId?: string | null;
  kekaSyncError?: string | null;
}

export type ProjectSortField =
  | "name"
  | "priority"
  | "status"
  | "startDate"
  | "endDate"
  | "createdAt"
  | "value"
  | "primaryPm";

export interface GetProjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  priority?: PriorityLevel;
  sortBy?: ProjectSortField;
  sortOrder?: "asc" | "desc";
}

export interface ProjectPortfolioStats {
  total: number;
  active: number;
  atRisk: number;
  delayed: number;
  completed: number;
  pendingClosure?: number;
  cancelled?: number;
  totalValue?: number;
}

export interface CreateProjectDto {
  name: string;
  objective: string;
  departmentId: string;
  customerId: string;
  engagementType: EngagementType;
  billingModel: BillingModel;
  methodology?: ProjectMethodology;
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
  milestones?: Array<{
    title: string;
    targetDate: string;
    weight?: number;
    status?: string;
    phaseId?: string;
  }>;
}

export interface PaginatedProjectsResponse {
  data: Project[];
  hasNextPage: boolean;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
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
  profileImageUrl: string | null;
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
  upcomingLeave: Array<{
    id: string;
    type: string;
    from: string;
    to: string;
    days: number;
    status: "approved" | "pending" | "rejected";
  }>;
  departmentStaffingAllowed: boolean;
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
  requestedBy: { id: string; name: string } | null;
  requestedAt: string | null;
  overrideReason?: string | null;
  approvedBy: { id: string; name: string } | null;
  kekaSyncedAt: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    designation: string;
    userId: string | null;
    profileImageUrl: string | null;
    department: Pick<Department, "id" | "code" | "name">;
  };
  weeklyCapacityHours: number;
  allocatedHoursTotal: number;
  remainingHoursTotal: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
  upcomingLeave: Array<{
    id: string;
    type: string;
    from: string;
    to: string;
    days: number;
    status: "approved" | "pending" | "rejected";
  }>;
  backupEmployeeId: string | null;
  backupEmployeeName: string | null;
}

export type AllocationMode = "hours" | "percent";

export interface PendingTeamMember {
  employeeId: string;
  name: string;
  profileImageUrl?: string | null;
  departmentName: string;
  designation: string;
  role: string;
  allocationMode: AllocationMode;
  hoursPerWeek: number;
  percentPerWeek: number;
  startDate: string;
  endDate?: string;
  remainingHours: number;
  isOverAllocated?: boolean;
  overrideReason?: string;
}

export interface GetTeamCandidatesParams {
  departmentId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface CreateProjectTeamPayload {
  allocations: Array<{
    employeeId: string;
    role: string;
    hours?: number;
    percent?: number;
    startDate: string;
    endDate?: string;
    overrideReason?: string;
  }>;
}

export interface AllocationPolicySummary {
  thresholdMode: "warn" | "block" | "approve";
  designationMismatchMode: "off" | "warn" | "block";
  departmentStaffingMode: "off" | "warn" | "block";
  designationRules: Array<{
    projectRole: string;
    allowedDesignations: string[];
  }>;
  departmentStaffingRules: {
    rule: "same_department_only" | "allow_list";
    byProjectDepartmentCode?: Record<string, string[]>;
  };
}

export interface CreateProjectTeamResult {
  created: ProjectAllocation[];
  warnings: string[];
  policy: AllocationPolicySummary;
}

export interface UpdateProjectTeamPayload {
  role?: string;
  hours?: number;
  percent?: number;
  backupEmployeeId?: string | null;
  startDate?: string;
  endDate?: string | null;
  overrideReason?: string;
}

export interface AllocationDateIssue {
  allocationId: string;
  employeeName: string;
  startDate: string;
  endDate: string | null;
  kinds: string[];
  messages: string[];
}

export interface AlignAllocationPreviewRow {
  allocationId: string;
  employeeName: string;
  currentStartDate: string;
  currentEndDate: string | null;
  proposedStartDate: string;
  proposedEndDate: string | null;
}

export interface AllocationDateIssuesResponse {
  projectStartDate: string;
  projectEndDate: string;
  issues: AllocationDateIssue[];
  alignPreview: AlignAllocationPreviewRow[];
  hasIssues: boolean;
  canAlign: boolean;
}

export interface AlignProjectAllocationsResult {
  updatedCount: number;
  warnings: string[];
}

export interface QueryAllocationDateIssuesParams {
  projectStartDate?: string;
  projectEndDate?: string;
}

export interface UpdateProjectTeamMemberResult {
  updated: ProjectAllocation;
  warnings: string[];
  policy: AllocationPolicySummary;
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

export interface TaskScheduleImpact {
  hasLeaveConflict: boolean;
  overlapDays: number;
  estimatedDelayDays: number;
  projectedTaskEnd: string | null;
  downstreamTaskCount: number;
  leaveFrom: string | null;
  leaveTo: string | null;
  leaveType: string | null;
  isCritical: boolean;
  hasBackup: boolean;
}

export interface LeaveImpactRow {
  id: string;
  projectId: string;
  projectName: string;
  assignee: {
    employeeId: string;
    name: string;
    userId: string | null;
    backupEmployeeId: string | null;
    backupEmployeeName: string | null;
  };
  leave: {
    type: string;
    from: string;
    to: string;
    days: number;
  };
  task: {
    taskId: string;
    title: string;
    priority: string;
    isOnCriticalPath: boolean;
    startDate: string | null;
    endDate: string | null;
    overlapDays: number;
    estimatedDelayDays: number;
    projectedTaskEnd: string | null;
    downstreamTaskCount: number;
    backupOwnerId: string | null;
    backupOwnerName: string | null;
  };
  allocationId: string | null;
  hasBackup: boolean;
  isCritical: boolean;
  isCriticalAllocation: boolean;
}

export interface LeaveImpactListResponse {
  rows: LeaveImpactRow[];
  criticalCount: number;
  withoutBackupCount: number;
}

export interface GetTaskAssigneeAvailabilityParams {
  projectId: string;
  ownerId: string;
  startDate?: string;
  endDate?: string;
  effortHours?: number;
  excludeTaskId?: string;
}

export interface TaskAssigneeAvailability {
  canCheck: boolean;
  message?: string;
  employeeName?: string;
  weeklyCapacityHours?: number;
  allocationHours?: number;
  otherTaskHours?: number;
  thisTaskHours?: number;
  allocatedHoursTotal?: number;
  remainingHours?: number;
  utilizationPercent?: number;
  isOverAllocated?: boolean;
  warnings: string[];
}
