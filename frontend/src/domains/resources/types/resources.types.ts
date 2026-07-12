export type UtilizationStatus = "over" | "optimal" | "under" | "available";
export type KekaSyncStatus = "synced" | "pending" | "error";
export type LeaveStatus = "approved" | "pending" | "rejected";

export interface TeamLeaveRange {
  id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
}

export interface AllocationPolicy {
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

export interface DesignationOptionsResponse {
  options: string[];
}

export interface TeamDirectoryAssignment {
  projectId: string;
  project: string;
  role: string;
  hoursPerWeek: number;
  allocationPercent: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
}

export interface ApiTeamDirectoryMember {
  id: string;
  name: string;
  email: string;
  designation: string;
  kekaEmployeeId: string;
  profileImageUrl: string | null;
  department: {
    id: string;
    code: string;
    name: string;
  };
  weeklyCapacityHours: number;
  allocatedHoursTotal: number;
  remainingHours: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
  isFullyBooked: boolean;
  projects: string[];
  assignments: TeamDirectoryAssignment[];
  upcomingLeave: TeamLeaveRange[];
  leaveHistory: TeamLeaveRange[];
}

export interface TeamDirectoryResponse {
  members: ApiTeamDirectoryMember[];
  stats: {
    total: number;
    over: number;
    available: number;
    avgUtil: number;
  };
  policy: AllocationPolicy;
  page: number;
  limit: number;
  total: number;
}

export type TeamDirectorySortField =
  | "name"
  | "designation"
  | "department"
  | "utilization"
  | "allocatedHours"
  | "remainingHours";

export type TeamLeaveSortField =
  | "employeeName"
  | "department"
  | "type"
  | "from"
  | "days"
  | "status";

export interface TeamLeaveRow {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
}

export interface TeamLeaveListResponse {
  rows: TeamLeaveRow[];
  page: number;
  limit: number;
  total: number;
}

export interface AllocationApprovalRow {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  role: string;
  hours: number | null;
  percent: number | null;
  startDate: string;
  endDate: string | null;
  weeklyCapacityHours: number;
  allocatedHoursAfter: number;
  utilizationPercent: number;
  requestedBy: { id: string; name: string };
  requestedAt: string;
}

export interface AllocationApprovalListResponse {
  rows: AllocationApprovalRow[];
  page: number;
  limit: number;
  total: number;
}

export interface TeamAssignment {
  project: string;
  role: string;
  hoursPerWeek: number;
  allocationPercent: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "completed";
}

export interface TeamLeaveRecord {
  id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
  reason?: string;
  approvedBy?: string;
}

export interface TeamDirectoryMember {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  color: string;
  designation: string;
  department: string;
  email: string;
  utilization: number;
  weeklyCapacity: number;
  allocatedHours: number;
  remainingHours: number;
  projects: string[];
  kekaEmployeeId: string;
  kekaSyncStatus: KekaSyncStatus;
  utilStatus: UtilizationStatus;
  manager?: string;
  assignments: TeamAssignment[];
  leaveHistory: TeamLeaveRecord[];
}

export type TimesheetEntryStatus = "draft" | "submitted" | "approved" | "rejected";

export interface TimesheetContextProject {
  id: string;
  name: string;
  tasks: { id: string; title: string }[];
}

export interface TimesheetContext {
  employeeId: string;
  employeeName: string;
  weeklyHours: number;
  dailyThresholdHours: number;
  projects: TimesheetContextProject[];
}

export interface TimesheetDaySummary {
  date: string;
  label: string;
  totalHours: number;
  isOverThreshold: boolean;
}

export interface TimesheetWeekEntry {
  id: string;
  workDate: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  hours: number;
  notes: string | null;
  isBillable: boolean;
  status: string;
  feedback: string | null;
  approvedBy: string | null;
}

export interface TimesheetWeekSummaryCard {
  weekStart: string;
  weekLabel: string;
  totalHours: number;
  billableHours: number;
  status: "draft" | "submitted" | "approved" | "mixed";
  submittedAt: string | null;
  approvedBy: string | null;
}

export interface TimesheetWeekResponse {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  totalHours: number;
  billableHours: number;
  days: TimesheetDaySummary[];
  entries: TimesheetWeekEntry[];
  recentWeeks: TimesheetWeekSummaryCard[];
}

export interface TimesheetEntry {
  id: string;
  date: string;
  project: string;
  task: string;
  hours: number;
  description: string;
  status: TimesheetEntryStatus;
  feedback?: string;
  approvedBy?: string;
}

export interface TimesheetWeekSummary {
  week: string;
  totalHours: number;
  billableHours: number;
  status: TimesheetEntryStatus;
  submittedAt?: string;
  approvedBy?: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface TimesheetSubmissionEntry {
  id: string;
  date: string;
  project: string;
  task: string;
  hours: number;
  description: string | null;
  kekaSyncStatus?: "synced" | "failed" | null;
}

export interface TimesheetSubmission {
  id: string;
  employeeId: string;
  employee: string;
  employeeInitials: string;
  employeeRole: string;
  weekStart: string;
  week: string;
  submittedAt: string;
  totalHours: number;
  billableHours: number;
  status: ApprovalStatus;
  entries: TimesheetSubmissionEntry[];
  feedback: string | null;
  isOverThreshold: boolean;
  isEscalated: boolean;
  hasSyncFailures: boolean;
  failedSyncCount: number;
}

export interface TimesheetApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
  overThreshold: number;
}

export interface TimesheetApprovalListResponse {
  rows: TimesheetSubmission[];
  page: number;
  limit: number;
  total: number;
  stats: TimesheetApprovalStats;
}

export interface TimesheetSyncFailure {
  timesheetId: string;
  approvalId: string;
  employeeName: string;
  projectName: string;
  taskName: string;
  workDate: string;
  hours: number;
  errorMsg: string | null;
  retryCount: number;
}

export interface TimesheetApprovalDecision {
  employeeId: string;
  weekStart: string;
  updatedCount: number;
  kekaSyncRefs: string[];
  syncFailures: string[];
  syncSuccessCount: number;
}
