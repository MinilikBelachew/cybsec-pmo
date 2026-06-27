import { NotificationEventType } from './notifications.constants';

export type NotifyInput = {
  eventType: NotificationEventType;
  recipientUserIds: string[];
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  sourceObjectType?: string;
  sourceObjectId?: string;
  actorId?: string;
};

export type NotificationEmailJobPayload = {
  notificationId: string;
  deliveryId: string;
  to: string;
  displayName: string;
  title: string;
  body: string;
  link: string;
};

export type NotificationRealtimePayload = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  readAt: string | null;
  createdAt: string;
};
