import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import {
  leaveImpactDedupeKey,
  leaveImpactSourceObjectId,
} from './utils/leave-impact.util';

export async function notifyLeaveCriticalConflict(
  notificationsService: NotificationsService,
  options: {
    recipientUserIds: string[];
    employeeName: string;
    projectId: string;
    projectName: string;
    taskId: string;
    taskTitle: string;
    leaveFrom: string;
    leaveTo: string;
    overlapDays: number;
    estimatedDelayDays: number;
    projectedTaskEnd: string | null;
    hasBackup: boolean;
    canApplyBackup: boolean;
    backupUserId: string | null;
    backupName: string | null;
    allocationId: string | null;
    isCriticalAllocation: boolean;
    actorId?: string;
  },
): Promise<void> {
  const backupNote = options.hasBackup
    ? ` Backup: ${options.backupName ?? 'assigned'}.`
    : ' No backup resource is assigned yet.';
  const slipNote =
    options.estimatedDelayDays > 0
      ? ` Projected schedule slip: ~${options.estimatedDelayDays} day(s).`
      : '';
  const allocationNote = options.isCriticalAllocation
    ? ' Critical allocation overlaps this leave window.'
    : '';

  const linkBase = `/dashboard/projects/${options.projectId}?taskId=${options.taskId}`;
  const link = options.canApplyBackup
    ? `${linkBase}&applyBackup=1`
    : linkBase;

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.LEAVE_CRITICAL_CONFLICT,
    recipientUserIds: options.recipientUserIds,
    title: 'Leave conflicts with critical assignment',
    body: `${options.employeeName} has approved leave (${options.leaveFrom} – ${options.leaveTo}) overlapping critical task "${options.taskTitle}" on ${options.projectName} by ${options.overlapDays} day(s).${allocationNote}${slipNote}${backupNote}`,
    payload: {
      link,
      dedupeKey: leaveImpactDedupeKey(
        options.taskId,
        options.leaveFrom,
        options.leaveTo,
      ),
      projectId: options.projectId,
      projectName: options.projectName,
      taskId: options.taskId,
      taskTitle: options.taskTitle,
      employeeName: options.employeeName,
      leaveFrom: options.leaveFrom,
      leaveTo: options.leaveTo,
      overlapDays: options.overlapDays,
      estimatedDelayDays: options.estimatedDelayDays,
      projectedTaskEnd: options.projectedTaskEnd,
      hasBackup: options.hasBackup,
      canApplyBackup: options.canApplyBackup,
      backupUserId: options.backupUserId,
      backupName: options.backupName,
      allocationId: options.allocationId,
      isCriticalAllocation: options.isCriticalAllocation,
    },
    sourceObjectType: 'LeaveImpact',
    sourceObjectId: leaveImpactSourceObjectId(
      options.taskId,
      options.leaveFrom,
      options.leaveTo,
    ),
    actorId: options.actorId,
  });
}

export async function notifyLeaveBackupApplied(
  notificationsService: NotificationsService,
  options: {
    recipientUserIds: string[];
    projectId: string;
    projectName: string;
    taskId: string;
    taskTitle: string;
    previousOwnerName: string;
    backupOwnerName: string;
    actorName: string;
    actorId: string;
  },
): Promise<void> {
  if (options.recipientUserIds.length === 0) {
    return;
  }

  await notificationsService.notify({
    eventType: NOTIFICATION_EVENT_TYPE.LEAVE_BACKUP_APPLIED,
    recipientUserIds: options.recipientUserIds,
    title: 'Backup owner assigned for leave coverage',
    body: `${options.actorName} reassigned task "${options.taskTitle}" on ${options.projectName} from ${options.previousOwnerName} to backup ${options.backupOwnerName}.`,
    payload: {
      link: `/dashboard/projects/${options.projectId}?taskId=${options.taskId}`,
      projectId: options.projectId,
      projectName: options.projectName,
      taskId: options.taskId,
      taskTitle: options.taskTitle,
      previousOwnerName: options.previousOwnerName,
      backupOwnerName: options.backupOwnerName,
    },
    sourceObjectType: 'Task',
    sourceObjectId: options.taskId,
    actorId: options.actorId,
  });
}

export async function resolveProjectPmUserIds(
  notificationsService: NotificationsService,
  projectId: string,
): Promise<string[]> {
  return notificationsService.resolveProjectPmUserIds(projectId);
}

export async function resolveProjectLeaveAlertUserIds(
  notificationsService: NotificationsService,
  projectId: string,
): Promise<string[]> {
  return notificationsService.resolveProjectPmAndSdmUserIds(projectId);
}
