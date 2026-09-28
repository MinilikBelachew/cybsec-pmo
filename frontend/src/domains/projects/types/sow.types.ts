export type SowSnapshot = {
  customerName: string | null;
  scope: string | null;
  deliverables: string | null;
  exclusions: string | null;
  assumptions: string | null;
  value: string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  billingModel: string | null;
  engagementType: string | null;
  approverSignatureName: string | null;
};

export type SowDocument = {
  id: string;
  projectId: string;
  opportunityId: string | null;
  creationMode: string;
  status: string;
  version: number;
  snapshot: SowSnapshot;
  s3FinalKey: string | null;
  documentLink: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  crmWrittenBackAt: string | null;
  createdAt: string;
  projectName?: string | null;
  customerName?: string | null;
};

export type CreateSowPayload = Record<string, never>;

export type UpdateSowPayload = {
  customerName?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  exclusions?: string | null;
  assumptions?: string | null;
  value?: string | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingModel?: string | null;
  engagementType?: string | null;
  s3FinalKey?: string | null;
  documentLink?: string | null;
};

export type ApproveSowPayload = {
  signatureName: string;
};

export type ListSowsParams = Record<string, never>;
