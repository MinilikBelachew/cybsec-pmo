import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';

const STAFFING_APPROVALS_LINK = '/dashboard/team/approvals';

export async function resolveStaffingApproverUserIds(
  notificationsService: NotificationsService,
  prisma: PrismaService,
  projectId: string,
  excludeUserIds: string[] = [],
): Promise<string[]> {
  const exclude = new Set(excludeUserIds.filter(Boolean));
  const pmIds = await notificationsService.resolveProjectPmUserIds(projectId);
  const primary = pmIds.filter((id) => !exclude.has(id));

  if (primary.length > 0) {
    return primary;
  }

  const pmoLeads = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { code: 'pmo_lead' },
      ...(exclude.size
        ? { id: { notIn: [...exclude] } }
        : {}),
    },
    select: { id: true },
  });

  return pmoLeads.map((user) => user.id);
}

export async function notifyStaffingRequested(
  notificationsService: NotificationsService,
  options: {
    recipientUserIds: string[];
    projectId: string;
    projectName: string;
    employeeName: string;
    role: string;
    allocationId: string;
    actorId: string;
    overrideReason?: string | null;
  },
): Promise<void> {
  if (options.recipientUserIds.length === 0) {
    return;
  }

  const reason = options.overrideReason?.trim();
  const reasonSuffix = reason ? ` Reason: ${reason}` : '';

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.STAFFING_REQUESTED,
    recipientUserIds: options.recipientUserIds,
    title: 'Over-allocation approval needed',
    body: `${options.employeeName} (${options.role}) on ${options.projectName} needs approval for over-allocation.${reasonSuffix}`,
    payload: {
      link: STAFFING_APPROVALS_LINK,
      projectId: options.projectId,
      projectName: options.projectName,
      employeeName: options.employeeName,
      role: options.role,
      allocationId: options.allocationId,
    },
    sourceObjectType: 'Allocation',
    sourceObjectId: options.allocationId,
    actorId: options.actorId,
  });
}

export async function notifyStaffingApproved(
  notificationsService: NotificationsService,
  options: {
    recipientUserId: string;
    projectName: string;
    employeeName: string;
    reviewerName: string;
    allocationId: string;
    actorId: string;
  },
): Promise<void> {
  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.STAFFING_APPROVED,
    recipientUserIds: [options.recipientUserId],
    title: 'Staffing request approved',
    body: `${options.reviewerName} approved over-allocation of ${options.employeeName} on ${options.projectName}.`,
    payload: {
      link: STAFFING_APPROVALS_LINK,
      projectName: options.projectName,
      employeeName: options.employeeName,
      allocationId: options.allocationId,
    },
    sourceObjectType: 'Allocation',
    sourceObjectId: options.allocationId,
    actorId: options.actorId,
  });
}

export async function notifyStaffingRejected(
  notificationsService: NotificationsService,
  options: {
    recipientUserId: string;
    projectName: string;
    employeeName: string;
    reviewerName: string;
    allocationId: string;
    actorId: string;
    comment?: string | null;
  },
): Promise<void> {
  const comment = options.comment?.trim();
  const commentSuffix = comment ? ` Feedback: ${comment}` : '';

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.STAFFING_REJECTED,
    recipientUserIds: [options.recipientUserId],
    title: 'Staffing request rejected',
    body: `${options.reviewerName} rejected over-allocation of ${options.employeeName} on ${options.projectName}.${commentSuffix}`,
    payload: {
      link: STAFFING_APPROVALS_LINK,
      projectName: options.projectName,
      employeeName: options.employeeName,
      allocationId: options.allocationId,
      feedback: comment ?? null,
    },
    sourceObjectType: 'Allocation',
    sourceObjectId: options.allocationId,
    actorId: options.actorId,
  });
}
