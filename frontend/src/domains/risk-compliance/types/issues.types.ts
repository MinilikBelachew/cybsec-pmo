export type IssuePriority = "Low" | "Medium" | "High" | "Critical";

export type IssueUser = {
  id: string;
  displayName: string;
  email: string;
};

export type Issue = {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  priority: string;
  ownerId: string;
  owner?: IssueUser;
  dueDate: string;
  expectedResolutionDate: string | null;
  status: string;
  resolutionNote: string | null;
  s3EvidenceKey: string | null;
  raisedBy: string;
  raiser?: IssueUser;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  requiresEscalation: boolean;
};

export type CreateIssuePayload = {
  title: string;
  priority: IssuePriority;
  ownerId: string;
  dueDate: string;
  expectedResolutionDate?: string;
  status?: string;
};

export type UpdateIssuePayload = Partial<CreateIssuePayload> & {
  expectedResolutionDate?: string | null;
  resolutionNote?: string | null;
  s3EvidenceKey?: string | null;
};

export type CloseIssuePayload = {
  resolutionNote?: string;
  s3EvidenceKey?: string;
};

export type ListIssuesParams = {
  projectId?: string;
  status?: string;
};
