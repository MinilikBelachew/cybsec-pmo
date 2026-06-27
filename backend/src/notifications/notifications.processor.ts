import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../database/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_EMAIL_JOB,
  NOTIFICATION_DELIVERY_STATUS,
} from './notifications.constants';
import { NotificationEmailJobPayload } from './notifications.types';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Process(NOTIFICATION_EMAIL_JOB)
  async handleEmail(job: Job<NotificationEmailJobPayload>): Promise<void> {
    const { deliveryId, to, displayName, title, body, link } = job.data;

    try {
      await this.mailService.sendNotification({
        to,
        data: {
          displayName,
          title,
          body,
          link,
        },
      });

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NOTIFICATION_DELIVERY_STATUS.SENT,
          sentAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NOTIFICATION_DELIVERY_STATUS.FAILED,
          error: message,
          retryCount: job.attemptsMade,
        },
      });

      this.logger.error(`Notification email failed for delivery ${deliveryId}`, error);
      throw error;
    }
  }
}
