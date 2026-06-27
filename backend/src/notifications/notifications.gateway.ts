import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { NotificationRealtimePayload } from './notifications.types';
import { notificationUserRoom } from './notifications.constants';

@Injectable()
export class NotificationsGateway {
  private readonly logger = new Logger(NotificationsGateway.name);
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, notification: NotificationRealtimePayload): void {
    if (!this.server) {
      this.logger.warn('Socket server not ready; skipping realtime notification emit.');
      return;
    }

    this.server
      .to(notificationUserRoom(userId))
      .emit('notification.created', notification);
  }
}
