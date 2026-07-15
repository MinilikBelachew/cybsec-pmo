import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { formatWeekLabel, getWeekEnd, getWeekStart, parseDateOnly } from './utils/week.util';
import { timesheetNotificationSourceObjectId } from './utils/timesheet-notification-source-id.util';

export async function notifyTimesheetSubmitted(
  notificationsService: NotificationsService,
  options: {
    recipientUserIds: string[];
    employeeName: string;
    weekStart: string;
    entryCount: number;
    actorId: string;
    resubmission?: boolean;
  },
): Promise<void> {
  const weekStartDate = getWeekStart(parseDateOnly(options.weekStart));
  const weekEndDate = getWeekEnd(weekStartDate);
  const weekLabel = formatWeekLabel(weekStartDate, weekEndDate);

  await notificationsService.notify({
    eventType: options.resubmission
      ? NOTIFICATION_EVENT_TYPE.TIMESHEET_RESUBMITTED
      : NOTIFICATION_EVENT_TYPE.TIMESHEET_SUBMITTED,
    recipientUserIds: options.recipientUserIds,
    title: options.resubmission ? 'Timesheet resubmitted' : 'Timesheet submitted',
    body: `${options.employeeName} ${options.resubmission ? 'resubmitted' : 'submitted'} ${options.entryCount} entr${options.entryCount === 1 ? 'y' : 'ies'} for ${weekLabel}.`,
    payload: {
      link: '/dashboard/timesheets/approvals',
      weekStart: options.weekStart,
      weekLabel,
      employeeName: options.employeeName,
      entryCount: options.entryCount,
    },
    sourceObjectType: 'Timesheet',
    sourceObjectId: timesheetNotificationSourceObjectId(
      `submitted:${options.weekStart}:${options.actorId}`,
    ),
    actorId: options.actorId,
  });
}

export async function notifyTimesheetApproved(
  notificationsService: NotificationsService,
  options: {
    recipientUserId: string;
    weekStart: string;
    entryCount: number;
    reviewerName: string;
    actorId: string;
    comment?: string | null;
  },
): Promise<void> {
  const weekStartDate = getWeekStart(parseDateOnly(options.weekStart));
  const weekEndDate = getWeekEnd(weekStartDate);
  const weekLabel = formatWeekLabel(weekStartDate, weekEndDate);
  const commentSuffix = options.comment?.trim()
    ? ` Note: ${options.comment.trim()}`
    : '';

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.TIMESHEET_APPROVED,
    recipientUserIds: [options.recipientUserId],
    title: 'Timesheet approved',
    body: `${options.reviewerName} approved your timesheet for ${weekLabel} (${options.entryCount} entr${options.entryCount === 1 ? 'y' : 'ies'}).${commentSuffix}`,
    payload: {
      link: `/dashboard/timesheets/log?weekStart=${options.weekStart}`,
      weekStart: options.weekStart,
      weekLabel,
      entryCount: options.entryCount,
      comment: options.comment ?? null,
    },
    sourceObjectType: 'Timesheet',
    sourceObjectId: timesheetNotificationSourceObjectId(
      `approved:${options.weekStart}:${options.recipientUserId}`,
    ),
    actorId: options.actorId,
  });
}

export async function notifyTimesheetRejected(
  notificationsService: NotificationsService,
  options: {
    recipientUserId: string;
    weekStart: string;
    entryCount: number;
    reviewerName: string;
    comment: string;
    actorId: string;
  },
): Promise<void> {
  const weekStartDate = getWeekStart(parseDateOnly(options.weekStart));
  const weekEndDate = getWeekEnd(weekStartDate);
  const weekLabel = formatWeekLabel(weekStartDate, weekEndDate);

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.TIMESHEET_REJECTED,
    recipientUserIds: [options.recipientUserId],
    title: 'Timesheet rejected — action required',
    body: `${options.reviewerName} rejected your timesheet for ${weekLabel}. Feedback: ${options.comment}`,
    payload: {
      link: `/dashboard/timesheets/log?weekStart=${options.weekStart}`,
      weekStart: options.weekStart,
      weekLabel,
      entryCount: options.entryCount,
      feedback: options.comment,
    },
    sourceObjectType: 'Timesheet',
    sourceObjectId: timesheetNotificationSourceObjectId(
      `rejected:${options.weekStart}:${options.recipientUserId}`,
    ),
    actorId: options.actorId,
  });
}

export async function resolveApproverUserIds(
  notificationsService: NotificationsService,
  projectIds: string[],
): Promise<string[]> {
  const pmIds = new Set<string>();

  for (const projectId of projectIds) {
    const ids = await notificationsService.resolveProjectPmUserIds(projectId);
    for (const id of ids) {
      pmIds.add(id);
    }
  }

  return [...pmIds];
}

export async function resolveEscalationRecipientUserIds(
  prisma: { user: { findMany: (args: unknown) => Promise<{ id: string }[]> } },
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { code: { in: ['pmo_lead', 'hr'] } },
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

export async function notifyTimesheetEscalated(
  notificationsService: NotificationsService,
  options: {
    recipientUserIds: string[];
    employeeId: string;
    employeeName: string;
    weekStart: string;
    entryCount: number;
    daysPending: number;
  },
): Promise<void> {
  const weekStartDate = getWeekStart(parseDateOnly(options.weekStart));
  const weekEndDate = getWeekEnd(weekStartDate);
  const weekLabel = formatWeekLabel(weekStartDate, weekEndDate);

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.TIMESHEET_ESCALATED,
    recipientUserIds: options.recipientUserIds,
    title: 'Timesheet approval overdue',
    body: `${options.employeeName}'s timesheet for ${weekLabel} has been pending for ${options.daysPending}+ days (${options.entryCount} entr${options.entryCount === 1 ? 'y' : 'ies'}).`,
    payload: {
      link: '/dashboard/timesheets/approvals',
      weekStart: options.weekStart,
      weekLabel,
      employeeName: options.employeeName,
      entryCount: options.entryCount,
    },
    sourceObjectType: 'TimesheetEscalation',
    sourceObjectId: timesheetNotificationSourceObjectId(
      `escalated:${options.employeeId}:${options.weekStart}`,
    ),
  });
}
