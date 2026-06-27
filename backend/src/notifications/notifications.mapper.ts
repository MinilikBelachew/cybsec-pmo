import { Notification } from '@prisma/client';
import { NotificationDto } from './dto/notification.dto';
import { NotificationRealtimePayload } from './notifications.types';

export function mapNotification(
  row: Notification,
): NotificationDto & NotificationRealtimePayload {
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    payload,
    sourceObjectType: row.sourceObjectType,
    sourceObjectId: row.sourceObjectId,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
