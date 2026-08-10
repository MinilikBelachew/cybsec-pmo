export type ActionPointStatus = "Open" | "In Progress" | "Done" | "Cancelled";
export type ActionPointSourceType =
  | "Project"
  | "Task"
  | "Meeting"
  | "MoM"
  | "Risk"
  | "Issue";
export type ActionPointPriority = "Low" | "Medium" | "High" | "Critical";

export type ActionPoint = {
  id: string;
  title: string;
  sourceType: ActionPointSourceType | string;
  sourceId: string;
  projectId: string | null;
  projectName?: string;
  linkedLabel?: string;
  ownerId: string;
  owner?: {
    id: string;
    displayName: string;
    email: string;
  };
  dueDate: string;
  priority: ActionPointPriority | string;
  status: ActionPointStatus | string;
  closureNote: string | null;
  closedAt: string | null;
  createdAt: string;
  isOverdue: boolean;
};

export type CreateActionPointPayload = {
  title: string;
  ownerId: string;
  dueDate: string;
  priority?: ActionPointPriority;
  sourceType?: ActionPointSourceType;
  sourceId?: string;
  status?: ActionPointStatus;
};

export type UpdateActionPointPayload = {
  title?: string;
  ownerId?: string;
  dueDate?: string;
  priority?: ActionPointPriority;
  sourceType?: ActionPointSourceType;
  sourceId?: string;
  status?: ActionPointStatus;
  closureNote?: string;
};
