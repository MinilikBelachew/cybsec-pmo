import {
  KEKA_EMPLOYMENT_STATUS_RELIEVED,
  KEKA_GROUP_TYPE_DEPARTMENT,
  KekaEmployeeProfile,
  KekaLeaveRequest,
  KekaLeaveRequestStatus,
} from './keka.types';
import { Prisma } from '@prisma/client';

export function resolveKekaEmployeeName(employee: KekaEmployeeProfile): string {
  const displayName = employee.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const first = employee.firstName?.trim() ?? '';
  const last = employee.lastName?.trim() ?? '';
  const fullName = `${first} ${last}`.trim();
  return fullName || employee.email?.trim() || employee.id || 'Unknown';
}

export function resolveKekaDesignation(employee: KekaEmployeeProfile): string {
  return (
    employee.jobTitle?.title?.trim() ||
    employee.secondaryJobTitle?.trim() ||
    'Unassigned'
  );
}

export function resolveKekaDepartmentName(employee: KekaEmployeeProfile): string | null {
  const groups = employee.groups ?? [];
  const departmentGroup =
    groups.find((group) => group.groupType === KEKA_GROUP_TYPE_DEPARTMENT) ??
    groups[0];

  return departmentGroup?.title?.trim() ?? null;
}

export function resolveKekaDepartmentGroupId(
  employee: KekaEmployeeProfile,
): string | null {
  const groups = employee.groups ?? [];
  const departmentGroup =
    groups.find((group) => group.groupType === KEKA_GROUP_TYPE_DEPARTMENT) ??
    groups[0];

  return departmentGroup?.id?.trim() ?? null;
}

export function resolveKekaJobTitleIdentifier(
  employee: KekaEmployeeProfile,
): string | null {
  return employee.jobTitle?.identifier?.trim() ?? null;
}

export function resolveKekaProfileImageUrl(
  image?: KekaEmployeeProfile['image'],
): string | null {
  const thumbs = image?.thumbs;
  if (!thumbs) {
    return null;
  }

  const preferredKeys = ['200', '128', '96', '64', '48', '32', 'default'];
  for (const key of preferredKeys) {
    const url = thumbs[key]?.trim();
    if (url) {
      return url;
    }
  }

  const firstUrl = Object.values(thumbs).find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );

  return firstUrl?.trim() ?? null;
}

export function mapKekaProfileImageFields(employee: KekaEmployeeProfile) {
  const image = employee.image;

  return {
    profileImageFileName: image?.fileName?.trim() ?? null,
    profileImageThumbs: image?.thumbs
      ? (image.thumbs as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    profileImageUrl: resolveKekaProfileImageUrl(image),
  };
}

export function toKekaDateOnly(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

export function mapKekaEmployeeFields(employee: KekaEmployeeProfile) {
  const managerKekaId = resolveKekaManagerId(employee);

  return {
    employeeNumber: employee.employeeNumber?.trim() ?? null,
    firstName: employee.firstName?.trim() ?? null,
    lastName: employee.lastName?.trim() ?? null,
    displayName: employee.displayName?.trim() ?? null,
    kekaDepartmentGroupId: resolveKekaDepartmentGroupId(employee),
    jobTitleIdentifier: resolveKekaJobTitleIdentifier(employee),
    reportsToKekaId: managerKekaId,
    timeType: employee.timeType ?? null,
    workerType: employee.workerType ?? null,
    shiftPolicyIdentifier: employee.shiftPolicyInfo?.identifier?.trim() ?? null,
    weeklyOffPolicyIdentifier:
      employee.weeklyOffPolicyInfo?.identifier?.trim() ?? null,
    attendanceNumber: employee.attendanceNumber?.trim() ?? null,
    employmentStatus: employee.employmentStatus ?? null,
    joiningDate: toKekaDateOnly(employee.joiningDate),
    exitDate: toKekaDateOnly(employee.exitDate),
    ...mapKekaProfileImageFields(employee),
  };
}

export function resolveKekaManagerId(employee: KekaEmployeeProfile): string | null {
  return employee.reportsTo?.id?.trim() ?? null;
}

export function isKekaEmployeeActive(employee: KekaEmployeeProfile): boolean {
  if (employee.employmentStatus === KEKA_EMPLOYMENT_STATUS_RELIEVED) {
    return false;
  }

  if (employee.exitDate) {
    const exitDate = new Date(employee.exitDate);
    if (!Number.isNaN(exitDate.getTime()) && exitDate <= new Date()) {
      return false;
    }
  }

  return true;
}

export function resolveKekaLeaveEmployeeId(leave: KekaLeaveRequest): string | null {
  return leave.employeeIdentifier?.trim() ?? null;
}

export function resolveKekaLeaveType(leave: KekaLeaveRequest): string {
  const primary = leave.selection?.[0]?.leaveTypeName?.trim();
  return primary || 'Leave';
}

export function isKekaLeaveApproved(leave: KekaLeaveRequest): boolean {
  return leave.status === KekaLeaveRequestStatus.Approved;
}
