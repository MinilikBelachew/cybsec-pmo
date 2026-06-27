export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATION_EMAIL_JOB = 'send-notification-email';

export const NOTIFICATION_DELIVERY_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
} as const;

export const NOTIFICATION_DELIVERY_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export const NOTIFICATION_EVENT_TYPE = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UPDATED: 'TASK_UPDATED',
  PROGRESS_SUBMITTED: 'PROGRESS_SUBMITTED',
  PROGRESS_APPROVED: 'PROGRESS_APPROVED',
  PROGRESS_REJECTED: 'PROGRESS_REJECTED',
  PROGRESS_REWORK: 'PROGRESS_REWORK',
} as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT_TYPE)[keyof typeof NOTIFICATION_EVENT_TYPE];

export const NOTIFICATIONS_SOCKET_NAMESPACE = 'notifications';

export const notificationUserRoom = (userId: string): string => `user:${userId}`;
