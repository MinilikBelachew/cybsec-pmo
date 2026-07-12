export type ProjectTemplateSummary = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  engagementType: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  phaseCount: number;
  milestoneCount: number;
  taskCount: number;
};

export type SaveProjectTemplatePayload = {
  projectId: string;
  name: string;
  category?: string;
  description?: string;
};

export type InstantiateProjectTemplatePayload = {
  name: string;
  objective: string;
  departmentId: string;
  customerId: string;
  engagementType: string;
  billingModel: string;
  priority?: string;
  startDate: string;
  endDate: string;
  value: number;
  currency?: string;
  primaryPmId: string;
  secondaryPmId?: string | null;
  status?: string;
  projectName?: string;
};
