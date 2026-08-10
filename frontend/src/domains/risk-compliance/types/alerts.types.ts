export type AlertRuleRecipient = {
  id: string;
  roleId: number;
  roleCode?: string;
  roleName?: string;
};

export type AlertRule = {
  id: string;
  eventType: string;
  thresholdConfig: Record<string, unknown>;
  channels: string[];
  reminderCadenceHrs: number;
  escalationDelayHrs: number;
  escalationRole: string;
  isActive: boolean;
  recipients: AlertRuleRecipient[];
  createdAt: string;
  updatedAt: string;
};

export type AlertEvent = {
  id: string;
  ruleId: string;
  eventType?: string;
  objectType: string;
  objectId: string | null;
  objectTitle?: string | null;
  channel: string;
  deliveryStatus: string;
  acknowledgedBy: string | null;
  escalationLevel: number;
  firedAt: string;
  ackedAt: string | null;
  nextReminderAt: string | null;
};

export type CreateAlertRulePayload = {
  eventType: string;
  thresholdConfig: Record<string, unknown>;
  channels: string[];
  reminderCadenceHrs?: number;
  escalationDelayHrs?: number;
  escalationRole: string;
  recipientRoleIds?: number[];
  isActive?: boolean;
};
