export type Escalation = {
  id: string;
  projectId: string;
  projectName?: string;
  customerId: string;
  customerName?: string;
  severity: string;
  slaTargetHrs: number;
  ownerId: string;
  owner?: { id: string; displayName: string; email: string };
  status: string;
  resolutionSummary: string | null;
  slaBreached: boolean;
  closedAt: string | null;
  createdAt: string;
  communications: Array<{
    id: string;
    channel: string;
    content: string;
    loggedBy: string;
    logger?: { id: string; displayName: string; email: string };
    createdAt: string;
  }>;
  isOverdue: boolean;
};

export type CreateEscalationPayload = {
  projectId: string;
  customerId: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  slaTargetHrs: number;
  ownerId: string;
  initialCommunication?: string;
  initialChannel?: "Call" | "Email" | "Meeting" | "Chat" | "Other";
};
