import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bull';
import { PrismaService } from '../database/prisma.service';
import { AllConfigType } from '../config/config.type';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_EMAIL_JOB,
  NOTIFICATION_DELIVERY_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
} from './notifications.constants';
import { NotificationsGateway } from './notifications.gateway';
import { mapNotification } from './notifications.mapper';
import { NotifyInput, NotificationEmailJobPayload } from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      const recipients = [...new Set(input.recipientUserIds.filter(Boolean))].filter(
        (userId) => userId !== input.actorId,
      );

      if (recipients.length === 0) {
        return;
      }

      const users = await this.prisma.user.findMany({
        where: {
          id: { in: recipients },
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      });

      for (const user of users) {
        await this.createForRecipient(user.id, user.email, user.displayName, input);
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch notification ${input.eventType}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findForUser(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      data: rows.map(mapNotification),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new NotFoundException({ errors: { notification: 'notificationNotFound' } });
    }

    if (existing.readAt) {
      return mapNotification(existing);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return mapNotification(updated);
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  async resolveProjectPmUserIds(projectId: string): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { primaryPmId: true, secondaryPmId: true },
    });

    if (!project) {
      return [];
    }

    return [project.primaryPmId, project.secondaryPmId].filter(
      (id): id is string => Boolean(id),
    );
  }

  private async createForRecipient(
    userId: string,
    email: string,
    displayName: string,
    input: NotifyInput,
  ): Promise<void> {
    const payload = input.payload ?? {};

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        payload: payload as Prisma.InputJsonValue,
        sourceObjectType: input.sourceObjectType,
        sourceObjectId: input.sourceObjectId,
      },
    });

    await this.prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: NOTIFICATION_DELIVERY_CHANNEL.IN_APP,
        status: NOTIFICATION_DELIVERY_STATUS.SENT,
        sentAt: new Date(),
      },
    });

    const mapped = mapNotification(notification);
    this.notificationsGateway.emitToUser(userId, mapped);

    const emailDelivery = await this.prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: NOTIFICATION_DELIVERY_CHANNEL.EMAIL,
        status: NOTIFICATION_DELIVERY_STATUS.QUEUED,
      },
    });

    const frontendDomain =
      this.configService.get('app.frontendDomain', { infer: true }) ??
      'http://localhost:3000';
    const relativeLink =
      typeof payload.link === 'string' ? payload.link : '/dashboard';
    const link = relativeLink.startsWith('http')
      ? relativeLink
      : `${frontendDomain.replace(/\/$/, '')}${relativeLink.startsWith('/') ? relativeLink : `/${relativeLink}`}`;

    const emailJob: NotificationEmailJobPayload = {
      notificationId: notification.id,
      deliveryId: emailDelivery.id,
      to: email,
      displayName,
      title: input.title,
      body: input.body,
      link,
    };

    await this.notificationsQueue.add(NOTIFICATION_EMAIL_JOB, emailJob, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    }).catch((error) => {
      this.logger.warn(
        `Email notification queue unavailable for ${notification.id}`,
        error instanceof Error ? error.message : undefined,
      );
    });
  }
}
