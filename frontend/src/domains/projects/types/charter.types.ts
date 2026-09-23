export type ProjectCharter = {
  id: string;
  projectId: string;
  customerId: string | null;
  sourceOrderId: string | null;
  status: string;
  purpose: string | null;
  successCriteria: string | null;
  scopeSummary: string | null;
  scopeExclusions: string | null;
  keyDeliverables: string | null;
  highLevelRisks: string | null;
  milestoneSchedule: string | null;
  valueSnapshot: string | null;
  resourceEstimates: string | null;
  stakeholders: string | null;
  pmAuthority: string | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
  incompleteFields: string[] | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approverSignatureName: string | null;
  createdAt: string;
};

export type UpdateProjectCharterPayload = {
  purpose?: string | null;
  successCriteria?: string | null;
  scopeSummary?: string | null;
  scopeExclusions?: string | null;
  keyDeliverables?: string | null;
  highLevelRisks?: string | null;
  milestoneSchedule?: string | null;
  valueSnapshot?: number | null;
  resourceEstimates?: string | null;
  stakeholders?: string | null;
  pmAuthority?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  incompleteFields?: string[] | null;
};

export type ApproveProjectCharterPayload = {
  signatureName: string;
};
