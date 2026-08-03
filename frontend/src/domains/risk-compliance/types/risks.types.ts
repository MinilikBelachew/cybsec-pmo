export type RiskStatus =
  | "Open"
  | "Mitigating"
  | "Accepted"
  | "Closed"
  | "Cancelled";

export type RiskOwner = {
  id: string;
  displayName: string;
  email: string;
};

export type Risk = {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  category: string;
  impact: number;
  likelihood: number;
  score: number;
  ownerId: string;
  owner?: RiskOwner;
  mitigationPlan: string | null;
  targetDate: string | null;
  residualImpact: number | null;
  residualLikelihood: number | null;
  residualRating: number | null;
  status: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isHigh: boolean;
};

export type CreateRiskPayload = {
  title: string;
  category: string;
  impact: number;
  likelihood: number;
  ownerId: string;
  mitigationPlan?: string;
  targetDate?: string;
  residualImpact?: number;
  residualLikelihood?: number;
  status?: string;
};

export type UpdateRiskPayload = Partial<CreateRiskPayload> & {
  mitigationPlan?: string | null;
  targetDate?: string | null;
  residualImpact?: number | null;
  residualLikelihood?: number | null;
};

export type ListRisksParams = {
  projectId?: string;
  status?: string;
};
