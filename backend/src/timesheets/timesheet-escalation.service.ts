import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import {
  notifyTimesheetEscalated,
  resolveApproverUserIds,
  resolveEscalationRecipientUserIds,
} from './timesheet-notifications.util';
import { TIMESHEET_ESCALATION_DAYS, TIMESHEET_STATUS } from './timesheets.constants';
import { formatDateOnly, getWeekStart } from './utils/week.util';
import { timesheetNotificationSourceObjectId } from './utils/timesheet-notification-source-id.util';

@Injectable()
export class TimesheetEscalationService {
  private readonly logger = new Logger(TimesheetEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyEscalatedSubmissions(): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - TIMESHEET_ESCALATION_DAYS);
    const dedupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.prisma.timesheet.findMany({
      where: {
        status: TIMESHEET_STATUS.SUBMITTED,
        updatedAt: { lt: threshold },
      },
      include: {
        employee: { select: { id: true, name: true } },
        project: { select: { id: true } },
      },
    });

    const groups = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        weekStart: string;
        entryCount: number;
        projectIds: string[];
      }
    >();

    for (const row of rows) {
      const weekStart = formatDateOnly(getWeekStart(row.workDate));
      const key = `${row.employeeId}:${weekStart}`;
      const existing = groups.get(key);

      if (existing) {
        existing.entryCount += 1;
        existing.projectIds.push(row.projectId);
      } else {
        groups.set(key, {
          employeeId: row.employeeId,
          employeeName: row.employee.name,
          weekStart,
          entryCount: 1,
          projectIds: [row.projectId],
        });
      }
    }

    const escalationRecipients = await resolveEscalationRecipientUserIds(
      this.prisma,
    );
    let notified = 0;

    for (const group of groups.values()) {
      const escalationKey = timesheetNotificationSourceObjectId(
        `escalated:${group.employeeId}:${group.weekStart}`,
      );
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          eventType: NOTIFICATION_EVENT_TYPE.TIMESHEET_ESCALATED,
          sourceObjectId: escalationKey,
          createdAt: { gte: dedupeSince },
        },
      });

      if (alreadySent) {
        continue;
      }

      const pmIds = await resolveApproverUserIds(
        this.notificationsService,
        [...new Set(group.projectIds)],
      );
      const recipientUserIds = [
        ...new Set([...escalationRecipients, ...pmIds]),
      ];

      if (recipientUserIds.length === 0) {
        continue;
      }

      await notifyTimesheetEscalated(this.notificationsService, {
        recipientUserIds,
        employeeId: group.employeeId,
        employeeName: group.employeeName,
        weekStart: group.weekStart,
        entryCount: group.entryCount,
        daysPending: TIMESHEET_ESCALATION_DAYS,
      });

      notified += 1;
    }

    if (notified > 0) {
      this.logger.log(`Sent ${notified} timesheet escalation notification(s)`);
    }

    return notified;
  }
}
