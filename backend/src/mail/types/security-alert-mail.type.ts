export type SecurityAlertMailData = {
  code: string;
  message: string;
  severity: 'warning' | 'critical';
  context?: Record<string, unknown>;
};
