import type {
  ApiTeamDirectoryMember,
  TeamDirectoryMember,
  TeamLeaveRange,
  UtilizationStatus,
} from "../types/resources.types";
import {
  avatarColorFromId,
  initialsFromName,
} from "@/shared/utils/employee-avatar";

export function resolveUtilizationStatus(member: ApiTeamDirectoryMember): UtilizationStatus {
  if (member.isOverAllocated) return "over";
  if (member.utilizationPercent >= 70) return "optimal";
  if (member.utilizationPercent >= 40) return "under";
  return "available";
}

export function mapTeamDirectoryMember(member: ApiTeamDirectoryMember): TeamDirectoryMember {
  return {
    id: member.id,
    name: member.name,
    initials: initialsFromName(member.name),
    avatarUrl: member.profileImageUrl,
    color: avatarColorFromId(member.id),
    designation: member.designation,
    department: member.department.name,
    email: member.email,
    utilization: member.utilizationPercent,
    weeklyCapacity: member.weeklyCapacityHours,
    allocatedHours: member.allocatedHoursTotal,
    remainingHours: member.remainingHours,
    projects: member.projects,
    kekaEmployeeId: member.kekaEmployeeId,
    kekaSyncStatus: "synced",
    utilStatus: resolveUtilizationStatus(member),
    assignments: member.assignments.map((assignment) => ({
      project: assignment.project,
      role: assignment.role,
      hoursPerWeek: assignment.hoursPerWeek,
      allocationPercent: assignment.allocationPercent ?? 0,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      status: assignment.status === "Active" ? "active" : "completed",
    })),
    upcomingLeave: (member.upcomingLeave ?? []).map(mapLeaveRange),
    leaveHistory: (member.leaveHistory ?? []).map(mapLeaveRange),
  };
}

function mapLeaveRange(leave: TeamLeaveRange) {
  return {
    id: leave.id,
    type: leave.type,
    from: leave.from,
    to: leave.to,
    days: leave.days,
    status: leave.status,
  };
}

export function formatLeaveLabel(leave: Pick<TeamLeaveRange, "from" | "to" | "days">): string {
  if (leave.from === leave.to) {
    return `${leave.from} (${leave.days}d)`;
  }
  return `${leave.from} – ${leave.to} (${leave.days}d)`;
}

/** Compact line for Directory cards / table (approved upcoming only). */
export function formatUpcomingLeaveSummary(
  leave: Array<Pick<TeamLeaveRange, "from" | "to" | "status">>,
): string | null {
  const upcoming = leave.filter((entry) => entry.status === "approved");
  if (upcoming.length === 0) {
    return null;
  }

  const first = upcoming[0];
  const range =
    first.from === first.to ? first.from : `${first.from} – ${first.to}`;

  if (upcoming.length === 1) {
    return `On leave: ${range}`;
  }

  return `On leave: ${range} +${upcoming.length - 1} more`;
}
