import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';

/** In-app deadline reminder window: due today or tomorrow (calendar days). */
function reminderWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

@Injectable()
export class TaskDeadlineReminderService {
  private readonly logger = new Logger(TaskDeadlineReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendDueSoonReminders(): Promise<number> {
    const { start, end } = reminderWindow();
    const since = new Date(Date.now() - 20 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        endDate: { gte: start, lte: end },
        status: { notIn: [TaskStatus.Done, TaskStatus.Approved] },
        ownerId: { not: null },
      },
      select: {
        id: true,
        title: true,
        endDate: true,
        ownerId: true,
        projectId: true,
      },
      take: 500,
    });

    if (tasks.length === 0) {
      return 0;
    }

    const alreadySent = await this.prisma.notification.findMany({
      where: {
        eventType: NOTIFICATION_EVENT_TYPE.TASK_DEADLINE_REMINDER,
        sourceObjectId: { in: tasks.map((t) => t.id) },
        createdAt: { gte: since },
      },
      select: { sourceObjectId: true },
    });
    const sentIds = new Set(
      alreadySent.map((n) => n.sourceObjectId).filter(Boolean) as string[],
    );

    let sent = 0;
    for (const task of tasks) {
      if (!task.ownerId || !task.endDate || sentIds.has(task.id)) {
        continue;
      }

      const dueLabel = task.endDate.toISOString().slice(0, 10);
      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.TASK_DEADLINE_REMINDER,
        recipientUserIds: [task.ownerId],
        title: 'Task deadline approaching',
        body: `Task “${task.title}” is due on ${dueLabel}.`,
        payload: {
          projectId: task.projectId,
          taskId: task.id,
          link: `/projects/${task.projectId}?taskId=${task.id}`,
        },
        sourceObjectType: 'Task',
        sourceObjectId: task.id,
        includeActorAsRecipient: true,
        inAppOnly: true,
      });
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} in-app task deadline reminder(s)`);
    }
    return sent;
  }
}
