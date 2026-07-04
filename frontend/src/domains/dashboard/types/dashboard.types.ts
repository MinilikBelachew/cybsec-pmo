export interface DashboardStats {
  projects: {
    total: number;
    active: number;
    atRisk: number;
    delayed: number;
    completed: number;
    totalValue?: number;
    totalSpent?: number;
    remainingBudget?: number;
  };
  tasks: {
    total: number;
    done: number;
    open: number;
    overdue: number;
    completionRate: number;
  };
  risks: {
    activeCount: number;
  };
  resources: {
    total: number;
  };
}

export interface ProjectHealthItem {
  id: string;
  name: string;
  pm: string;
  status: "on-track" | "at-risk" | "delayed";
  progress: number;
  tasks: number;
  risks: number;
  budget?: number;
}

export interface MilestoneItem {
  id: string;
  project: string;
  label: string;
  date: string;
  status: "completed" | "on-track" | "at-risk" | "delayed";
  daysLeft: number | null;
}

export interface TeamMemberUtilization {
  name: string;
  role: string;
  dept: string;
  util: number;
  billable: number;
  projects: number;
  status: "over" | "ok" | "under";
}

export interface DeptHourBreakdown {
  dept: string;
  billable: number;
  nonBillable: number;
  total: number;
}

export interface ResourceUtilizationResponse {
  team: TeamMemberUtilization[];
  departments: DeptHourBreakdown[];
}

export interface BurnRateResponse {
  months: string[];
  planned: number[];
  actual: (number | null)[];
  summary: {
    totalBudget: string;
    spentToDate: string;
    remaining: string;
    forecastEoy: string;
  };
}

export interface AuditLogFeedItem {
  actor: string;
  actionKey: string;
  target: string;
  module: string;
  time: string;
  createdAt: string;
}
