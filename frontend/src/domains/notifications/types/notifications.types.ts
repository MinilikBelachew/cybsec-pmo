export type NotificationRecord = {
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

export type NotificationsResponse = {
  data: NotificationRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
};
