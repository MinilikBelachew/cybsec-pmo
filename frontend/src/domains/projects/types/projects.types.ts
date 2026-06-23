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
}
