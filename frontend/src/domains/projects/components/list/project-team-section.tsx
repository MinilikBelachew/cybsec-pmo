"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Loader2, Pencil, Trash2, Users2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useAddProjectTeamMembersMutation,
  useAlignProjectAllocationDatesMutation,
  useGetAllocationDateIssuesQuery,
  useGetTeamCandidatesQuery,
  useGetProjectTeamQuery,
  useRemoveProjectTeamMemberMutation,
  useUpdateProjectTeamMemberMutation,
  useSetAllocationBackupMutation,
  useGetDepartmentsQuery,
  type AllocationMode,
  type PendingTeamMember,
  type ProjectAllocation,
  type TeamCandidate,
} from "@/domains/projects";
import { AllocationAlignDialog } from "@/domains/projects/components/list/allocation-align-dialog";
import {
  formatAllocationDateLabel,
  formatAllocationDateRange,
  formatDateValue,
  isAllocationNotStartedYet,
} from "@/domains/projects/utils/allocation-date.utils";
import { useGetAllocationPolicyQuery, useGetDesignationOptionsQuery } from "@/domains/resources/api/resources.api";
import {
  hasDepartmentStaffingMismatch,
  hasDesignationMismatch,
  getDesignationMismatchMessage,
  isPolicyBlocked,
} from "@/domains/resources/utils/allocation-policy.utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { EmployeePickerSelect } from "@/shared/components/employee-picker-select";
import { ProjectRoleSelect } from "@/shared/components/designation-select";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";

interface ProjectTeamSectionProps {
  projectId?: string | null;
  departmentId?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  pendingMembers: PendingTeamMember[];
  onPendingMembersChange: (members: PendingTeamMember[]) => void;
  canEdit?: boolean;
  filterByDepartment?: boolean;
  variant?: "form" | "workspace";
}

interface DraftMemberConfig {
  role: string;
  allocationMode: AllocationMode;
  hoursPerWeek: string;
  percentPerWeek: string;
  overrideReason?: string;
}

interface ExistingMemberEditDraft {
  role: string;
  allocationMode: AllocationMode;
  hoursPerWeek: string;
  percentPerWeek: string;
  startDate: string;
  endDate: string;
  overrideReason: string;
}

const DEFAULT_HOURS = "20";
const DEFAULT_PERCENT = "50";
const OVERRIDE_REASON_MIN = 10;

function availabilityLabel(candidate: TeamCandidate): string {
  if (candidate.isOverAllocated) return "Over-allocated";
  if (candidate.isFullyBooked) return "Fully booked";
  return `${candidate.remainingHours}h remaining`;
}

function formatLeaveRanges(
  leave: Array<{ from: string; to: string }>,
): string {
  return leave
    .map((entry) =>
      entry.from === entry.to ? entry.from : `${entry.from} – ${entry.to}`,
    )
    .join(", ");
}

function resolveWeeklyHours(
  mode: AllocationMode,
  hours: number,
  percent: number,
  weeklyCapacity: number,
): number {
  if (mode === "percent") {
    return (weeklyCapacity * percent) / 100;
  }
  return hours;
}

function formatAllocationSummary(member: Pick<ProjectAllocation, "hours" | "percent">): string {
  if (member.percent != null) {
    return `${member.percent}%/week on this project`;
  }
  return `${member.hours ?? 0}h/week on this project`;
}

function buildPendingMember(
  candidate: TeamCandidate,
  config: DraftMemberConfig,
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): PendingTeamMember | null {
  if (!config.role.trim()) return null;

  const hours = Number(config.hoursPerWeek);
  const percent = Number(config.percentPerWeek);
  const weeklyHours =
    config.allocationMode === "percent"
      ? resolveWeeklyHours("percent", 0, percent, candidate.weeklyCapacityHours)
      : hours;

  if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) return null;
  if (config.allocationMode === "hours" && (!Number.isFinite(hours) || hours <= 0)) {
    return null;
  }
  if (config.allocationMode === "percent" && (!Number.isFinite(percent) || percent <= 0)) {
    return null;
  }

  const wouldExceed =
    candidate.allocatedHoursTotal + weeklyHours > candidate.weeklyCapacityHours;

  return {
    employeeId: candidate.employeeId,
    name: candidate.name,
    profileImageUrl: candidate.profileImageUrl,
    departmentName: candidate.department.name,
    designation: candidate.designation,
    role: config.role.trim(),
    allocationMode: config.allocationMode,
    hoursPerWeek: config.allocationMode === "hours" ? hours : weeklyHours,
    percentPerWeek: config.allocationMode === "percent" ? percent : Math.round((weeklyHours / candidate.weeklyCapacityHours) * 100),
    startDate: formatDateValue(startDate) ?? new Date().toISOString().slice(0, 10),
    endDate: formatDateValue(endDate),
    remainingHours: candidate.remainingHours,
    isOverAllocated: wouldExceed,
    ...(wouldExceed && config.overrideReason?.trim()
      ? { overrideReason: config.overrideReason.trim() }
      : {}),
  };
}

function buildDraftMembers(
  checkedCandidates: TeamCandidate[],
  draftConfig: Record<string, DraftMemberConfig>,
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): PendingTeamMember[] {
  const members: PendingTeamMember[] = [];

  for (const candidate of checkedCandidates) {
    const config = draftConfig[candidate.employeeId];
    if (!config) continue;

    const member = buildPendingMember(candidate, config, startDate, endDate);
    if (member) members.push(member);
  }

  return members;
}

function toAllocationBody(
  member: Pick<
    PendingTeamMember,
    | "role"
    | "allocationMode"
    | "hoursPerWeek"
    | "percentPerWeek"
    | "overrideReason"
    | "isOverAllocated"
  >,
) {
  return {
    ...(member.allocationMode === "percent"
      ? { role: member.role, percent: member.percentPerWeek }
      : { role: member.role, hours: member.hoursPerWeek }),
    ...(member.isOverAllocated && member.overrideReason?.trim()
      ? { overrideReason: member.overrideReason.trim() }
      : {}),
  };
}

function AllocationModeToggle({
  value,
  onChange,
  className,
}: {
  value: AllocationMode;
  onChange: (mode: AllocationMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-slate-200 p-0.5 text-[10px] font-semibold dark:border-white/[0.08]",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "rounded px-2 py-1",
          value === "hours" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
        onClick={() => onChange("hours")}
      >
        Hrs
      </button>
      <button
        type="button"
        className={cn(
          "rounded px-2 py-1",
          value === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
        onClick={() => onChange("percent")}
      >
        %
      </button>
    </div>
  );
}

export interface ProjectTeamSectionHandle {
  collectMembersToSave: () => PendingTeamMember[];
}

export const ProjectTeamSection = forwardRef<
  ProjectTeamSectionHandle,
  ProjectTeamSectionProps
>(function ProjectTeamSection(
  {
    projectId,
    departmentId,
    startDate,
    endDate,
    pendingMembers,
    onPendingMembersChange,
    canEdit = true,
    filterByDepartment = false,
    variant = "form",
  },
  ref,
) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [checkedCandidatesMap, setCheckedCandidatesMap] = useState<Record<string, TeamCandidate>>({});
  const [draftConfig, setDraftConfig] = useState<Record<string, DraftMemberConfig>>({});
  const [searchVal, setSearchVal] = useState("");
  const [bulkOverrideReason, setBulkOverrideReason] = useState("");
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExistingMemberEditDraft | null>(null);
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(searchVal, 300);

  const { data: existingTeam = [], refetch: refetchTeam } = useGetProjectTeamQuery(
    projectId ?? "",
    { skip: !projectId },
  );

  const [removeMember, { isLoading: isRemoving }] = useRemoveProjectTeamMemberMutation();
  const [addProjectTeamMembers, { isLoading: isAddingMembers }] =
    useAddProjectTeamMembersMutation();
  const [updateProjectTeamMember, { isLoading: isUpdatingMember }] =
    useUpdateProjectTeamMemberMutation();
  const [setAllocationBackup, { isLoading: isSettingBackup }] =
    useSetAllocationBackupMutation();
  const [alignProjectAllocationDates, { isLoading: isAligning }] =
    useAlignProjectAllocationDatesMutation();

  const planningStart = formatDateValue(startDate);
  const planningEnd = formatDateValue(endDate);
  const hasPlanningWindow = Boolean(planningStart && planningEnd);

  const { data: allocationDateIssues, refetch: refetchAllocationDateIssues } =
    useGetAllocationDateIssuesQuery(
      {
        projectId: projectId ?? "",
        params:
          hasPlanningWindow && projectId
            ? { projectStartDate: planningStart, projectEndDate: planningEnd }
            : undefined,
      },
      { skip: !projectId || !hasPlanningWindow },
    );

  const allocationIssueMessages = useMemo(
    () =>
      allocationDateIssues?.issues
        .filter((issue) => issue.kinds.includes("not_started_yet"))
        .flatMap((issue) => issue.messages) ?? [],
    [allocationDateIssues?.issues],
  );

  const alignDialogIssueMessages = useMemo(
    () =>
      allocationDateIssues?.issues
        .filter((issue) => issue.kinds.includes("outside_project_window"))
        .flatMap((issue) => issue.messages) ?? [],
    [allocationDateIssues?.issues],
  );

  const candidateQuery = useMemo(
    () => ({
      departmentId: filterByDepartment && departmentId ? departmentId : undefined,
      projectId: projectId ?? undefined,
      search: debouncedSearch || undefined,
      ...(hasPlanningWindow
        ? { startDate: planningStart, endDate: planningEnd }
        : {}),
    }),
    [departmentId, filterByDepartment, projectId, debouncedSearch, planningStart, planningEnd, hasPlanningWindow],
  );

  const { data: candidates = [], isLoading: loadingCandidates } =
    useGetTeamCandidatesQuery(candidateQuery, { skip: !hasPlanningWindow });

  const { data: allocationPolicy } = useGetAllocationPolicyQuery();
  const { data: designationOptionsData } = useGetDesignationOptionsQuery();
  const designationOptions = designationOptionsData?.options ?? [];
  const { data: departments = [] } = useGetDepartmentsQuery();
  const thresholdMode = allocationPolicy?.thresholdMode ?? "warn";

  const projectDepartmentCode = useMemo(() => {
    if (!departmentId) return "";
    return departments.find((dept) => dept.id === departmentId)?.code ?? "";
  }, [departmentId, departments]);

  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    existingTeam.forEach((row) => ids.add(row.employeeId));
    pendingMembers.forEach((row) => ids.add(row.employeeId));
    return ids;
  }, [existingTeam, pendingMembers]);

  const availableCandidates = candidates.filter(
    (candidate) => !assignedEmployeeIds.has(candidate.employeeId),
  );

  const backupOptions = useMemo(
    () =>
      candidates.map((candidate) => ({
        id: candidate.employeeId,
        name: candidate.name,
        profileImageUrl: candidate.profileImageUrl,
        subtitle: `${candidate.department.name} · ${candidate.designation}`,
      })),
    [candidates],
  );

  const checkedCandidates = useMemo(
    () => Object.values(checkedCandidatesMap),
    [checkedCandidatesMap],
  );

  useImperativeHandle(
    ref,
    () => ({
      collectMembersToSave: () => {
        const configs: Record<string, DraftMemberConfig> = {};
        for (const [employeeId, config] of Object.entries(draftConfig)) {
          configs[employeeId] = {
            ...config,
            overrideReason: bulkOverrideReason.trim() || config.overrideReason,
          };
        }
        return buildDraftMembers(checkedCandidates, configs, startDate, endDate);
      },
    }),
    [bulkOverrideReason, checkedCandidates, draftConfig, startDate, endDate],
  );

  const toggleCandidate = (candidate: TeamCandidate, checked: boolean) => {
    if (checked) {
      setCheckedIds((prev) => [...prev, candidate.employeeId]);
      setCheckedCandidatesMap((prev) => ({
        ...prev,
        [candidate.employeeId]: candidate,
      }));
      setDraftConfig((prev) => ({
        ...prev,
        [candidate.employeeId]: {
          role: candidate.designation,
          allocationMode: "hours",
          hoursPerWeek: DEFAULT_HOURS,
          percentPerWeek: DEFAULT_PERCENT,
        },
      }));
      return;
    }

    setCheckedIds((prev) => prev.filter((id) => id !== candidate.employeeId));
    setCheckedCandidatesMap((prev) => {
      const next = { ...prev };
      delete next[candidate.employeeId];
      return next;
    });
    setDraftConfig((prev) => {
      const next = { ...prev };
      delete next[candidate.employeeId];
      return next;
    });
  };

  const updateDraftConfig = (
    employeeId: string,
    patch: Partial<DraftMemberConfig>,
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      [employeeId]: {
        role: prev[employeeId]?.role ?? "",
        allocationMode: prev[employeeId]?.allocationMode ?? "hours",
        hoursPerWeek: prev[employeeId]?.hoursPerWeek ?? DEFAULT_HOURS,
        percentPerWeek: prev[employeeId]?.percentPerWeek ?? DEFAULT_PERCENT,
        ...patch,
      },
    }));
  };

  const handleAddSelected = async () => {
    const configs: Record<string, DraftMemberConfig> = {};
    for (const [employeeId, config] of Object.entries(draftConfig)) {
      configs[employeeId] = {
        ...config,
        overrideReason: bulkOverrideReason.trim() || config.overrideReason,
      };
    }
    const draftMembers = buildDraftMembers(
      checkedCandidates,
      configs,
      startDate,
      endDate,
    );
    if (draftMembers.length === 0) return;

    const needsOverride =
      thresholdMode !== "block" &&
      draftMembers.some((member) => member.isOverAllocated);
    if (needsOverride && bulkOverrideReason.trim().length < OVERRIDE_REASON_MIN) {
      toast.error(
        `Over-allocation requires an override reason (at least ${OVERRIDE_REASON_MIN} characters).`,
      );
      return;
    }

    if (projectId) {
      try {
        const teamResult = await addProjectTeamMembers({
          projectId,
          body: {
            allocations: draftMembers.map((member) => ({
              employeeId: member.employeeId,
              ...toAllocationBody(member),
              startDate: member.startDate,
              endDate: member.endDate,
            })),
          },
        }).unwrap();

        teamResult.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
        toast.success(
          `${teamResult.created.length} team member${teamResult.created.length === 1 ? "" : "s"} added to project.`,
        );
        setCheckedIds([]);
        setCheckedCandidatesMap({});
        setDraftConfig({});
        setBulkOverrideReason("");
        setPickerOpen(false);
        refetchTeam();
      } catch (err: unknown) {
        const apiError = err as {
          data?: { errors?: { allocation?: string; overrideReason?: string }; message?: string };
        };
        const allocationError =
          apiError?.data?.errors?.overrideReason ??
          apiError?.data?.errors?.allocation;
        toast.error(
          allocationError ?? apiError?.data?.message ?? "Failed to add team members.",
        );
      }
      return;
    }

    onPendingMembersChange([...pendingMembers, ...draftMembers]);
    setCheckedIds([]);
    setCheckedCandidatesMap({});
    setDraftConfig({});
    setBulkOverrideReason("");
    setPickerOpen(false);
  };

  const handleRemovePending = (employeeId: string) => {
    onPendingMembersChange(pendingMembers.filter((member) => member.employeeId !== employeeId));
  };

  const handleUpdatePending = (
    employeeId: string,
    patch: Partial<
      Pick<
        PendingTeamMember,
        "role" | "allocationMode" | "hoursPerWeek" | "percentPerWeek" | "overrideReason"
      >
    >,
  ) => {
    onPendingMembersChange(
      pendingMembers.map((member) => {
        if (member.employeeId !== employeeId) return member;

        const updated = { ...member, ...patch };
        const candidate = candidates.find((row) => row.employeeId === employeeId);
        if (candidate) {
          const weeklyHours = resolveWeeklyHours(
            updated.allocationMode,
            updated.hoursPerWeek,
            updated.percentPerWeek,
            candidate.weeklyCapacityHours,
          );
          updated.isOverAllocated =
            candidate.allocatedHoursTotal + weeklyHours > candidate.weeklyCapacityHours;
        }

        return updated;
      }),
    );
  };

  const handleRemoveExisting = async (allocationId: string) => {
    if (!projectId) return;
    if (editingAllocationId === allocationId) {
      setEditingAllocationId(null);
      setEditDraft(null);
    }
    await removeMember({ projectId, allocationId }).unwrap();
    refetchTeam();
  };

  const startEditingExisting = (member: ProjectAllocation) => {
    setEditingAllocationId(member.id);
    setEditDraft({
      role: member.role,
      allocationMode: member.percent != null ? "percent" : "hours",
      hoursPerWeek: String(member.hours ?? DEFAULT_HOURS),
      percentPerWeek: String(member.percent ?? DEFAULT_PERCENT),
      startDate: member.startDate,
      endDate: member.endDate ?? "",
      overrideReason: member.overrideReason ?? "",
    });
  };

  const cancelEditingExisting = () => {
    setEditingAllocationId(null);
    setEditDraft(null);
  };

  const handleBackupChange = async (
    member: ProjectAllocation,
    backupEmployeeId: string | null,
  ) => {
    if (!projectId) return;
    if (backupEmployeeId === member.employeeId) {
      toast.error("Backup cannot be the same as the primary resource.");
      return;
    }
    try {
      await setAllocationBackup({
        projectId,
        allocationId: member.id,
        backupEmployeeId,
      }).unwrap();
      toast.success(backupEmployeeId ? "Backup resource assigned." : "Backup removed.");
      refetchTeam();
    } catch {
      toast.error("Failed to update backup resource.");
    }
  };

  const handleSaveExisting = async (member: ProjectAllocation) => {
    if (!projectId || !editDraft) return;

    const hours = Number(editDraft.hoursPerWeek);
    const percent = Number(editDraft.percentPerWeek);
    if (!editDraft.role.trim()) {
      toast.error("Project role is required.");
      return;
    }
    if (editDraft.allocationMode === "hours" && (!Number.isFinite(hours) || hours <= 0)) {
      toast.error("Enter valid weekly hours.");
      return;
    }
    if (editDraft.allocationMode === "percent" && (!Number.isFinite(percent) || percent <= 0)) {
      toast.error("Enter valid weekly percent.");
      return;
    }
    if (!editDraft.startDate) {
      toast.error("Allocation start date is required.");
      return;
    }
    if (editDraft.endDate && editDraft.endDate < editDraft.startDate) {
      toast.error("Allocation end date must be on or after the start date.");
      return;
    }
    if (
      thresholdMode !== "block" &&
      editWouldOverAllocate(member) &&
      editDraft.overrideReason.trim().length < OVERRIDE_REASON_MIN
    ) {
      toast.error(
        `Over-allocation requires an override reason (at least ${OVERRIDE_REASON_MIN} characters).`,
      );
      return;
    }

    try {
      const result = await updateProjectTeamMember({
        projectId,
        allocationId: member.id,
        body: {
          role: editDraft.role.trim(),
          ...(editDraft.allocationMode === "percent"
            ? { percent }
            : { hours }),
          startDate: editDraft.startDate,
          endDate: editDraft.endDate || null,
          ...(editWouldOverAllocate(member)
            ? { overrideReason: editDraft.overrideReason.trim() }
            : {}),
        },
      }).unwrap();

      result.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
      toast.success("Team member updated.");
      setEditingAllocationId(null);
      setEditDraft(null);
      refetchTeam();
    } catch (err: unknown) {
      const apiError = err as {
        data?: { errors?: { allocation?: string }; message?: string };
      };
      toast.error(
        apiError?.data?.errors?.allocation ??
          apiError?.data?.message ??
          "Failed to update team member.",
      );
    }
  };

  const handleAlignAllocations = async () => {
    if (!projectId || !hasPlanningWindow) return;

    try {
      const result = await alignProjectAllocationDates({
        projectId,
        body: {
          projectStartDate: planningStart,
          projectEndDate: planningEnd,
        },
      }).unwrap();

      result.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
      if (result.updatedCount > 0) {
        toast.success(
          `Aligned ${result.updatedCount} allocation${result.updatedCount === 1 ? "" : "s"} to project dates.`,
        );
      }
      setAlignDialogOpen(false);
      refetchTeam();
      refetchAllocationDateIssues();
    } catch {
      toast.error("Failed to align allocations.");
    }
  };

  const draftWouldOverAllocate = (candidate: TeamCandidate) => {
    const config = draftConfig[candidate.employeeId];
    if (!config) return false;

    const hours = Number(config.hoursPerWeek);
    const percent = Number(config.percentPerWeek);
    const weeklyHours = resolveWeeklyHours(
      config.allocationMode,
      hours,
      percent,
      candidate.weeklyCapacityHours,
    );

    if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) return false;
    return candidate.allocatedHoursTotal + weeklyHours > candidate.weeklyCapacityHours;
  };

  const draftHasDesignationMismatch = (candidate: TeamCandidate) => {
    if (!allocationPolicy) return false;
    const config = draftConfig[candidate.employeeId];
    if (!config?.role.trim()) return false;
    return hasDesignationMismatch(
      allocationPolicy,
      config.role,
      candidate.designation,
    );
  };

  const draftHasDepartmentMismatch = (candidate: TeamCandidate) => {
    if (!allocationPolicy || allocationPolicy.departmentStaffingMode === "off") {
      return false;
    }
    if (projectId) {
      return !candidate.departmentStaffingAllowed;
    }
    return hasDepartmentStaffingMismatch(
      allocationPolicy,
      projectDepartmentCode,
      candidate.department.code,
    );
  };

  const editWouldOverAllocate = (member: ProjectAllocation) => {
    if (!editDraft) return false;

    const hours = Number(editDraft.hoursPerWeek);
    const percent = Number(editDraft.percentPerWeek);
    const newWeeklyHours = resolveWeeklyHours(
      editDraft.allocationMode,
      hours,
      percent,
      member.weeklyCapacityHours,
    );
    const currentWeeklyHours =
      member.percent != null
        ? resolveWeeklyHours("percent", 0, member.percent, member.weeklyCapacityHours)
        : (member.hours ?? 0);
    const totalWithoutCurrent = member.allocatedHoursTotal - currentWeeklyHours;

    if (!Number.isFinite(newWeeklyHours) || newWeeklyHours <= 0) return false;
    return totalWithoutCurrent + newWeeklyHours > member.weeklyCapacityHours;
  };

  const editHasDesignationMismatch = (member: ProjectAllocation) => {
    if (!allocationPolicy || !editDraft?.role.trim()) return false;
    return hasDesignationMismatch(
      allocationPolicy,
      editDraft.role,
      member.employee.designation,
    );
  };

  const editHasDepartmentMismatch = (member: ProjectAllocation) => {
    if (!allocationPolicy || allocationPolicy.departmentStaffingMode === "off") {
      return false;
    }
    return hasDepartmentStaffingMismatch(
      allocationPolicy,
      projectDepartmentCode,
      member.employee.department.code,
    );
  };

  const hasBlockedOverAllocation =
    thresholdMode === "block" &&
    checkedCandidates.some((candidate) => draftWouldOverAllocate(candidate));

  const hasBlockedDesignation =
    allocationPolicy != null &&
    checkedCandidates.some((candidate) =>
      isPolicyBlocked(
        allocationPolicy.designationMismatchMode,
        draftHasDesignationMismatch(candidate),
      ),
    );

  const hasBlockedDepartment =
    allocationPolicy != null &&
    checkedCandidates.some((candidate) =>
      isPolicyBlocked(
        allocationPolicy.departmentStaffingMode,
        draftHasDepartmentMismatch(candidate),
      ),
    );

  const needsOverrideReason =
    thresholdMode !== "block" &&
    checkedCandidates.some((candidate) => draftWouldOverAllocate(candidate));

  const canAddSelected =
    checkedCandidates.length > 0 &&
    checkedCandidates.every((candidate) => {
      const config = draftConfig[candidate.employeeId];
      if (!config?.role.trim()) return false;
      if (config.allocationMode === "hours") {
        const hours = Number(config.hoursPerWeek);
        return Number.isFinite(hours) && hours > 0;
      }
      const percent = Number(config.percentPerWeek);
      return Number.isFinite(percent) && percent > 0;
    }) &&
    !hasBlockedOverAllocation &&
    !hasBlockedDesignation &&
    !hasBlockedDepartment &&
    (!needsOverrideReason || bulkOverrideReason.trim().length >= OVERRIDE_REASON_MIN);

  const renderAllocationInput = (
    mode: AllocationMode,
    hoursValue: string,
    percentValue: string,
    onHoursChange: (value: string) => void,
    onPercentChange: (value: string) => void,
  ) => (
    <div className="flex items-center gap-1.5">
      {mode === "hours" ? (
        <Input
          type="number"
          min={0.5}
          step={0.5}
          value={hoursValue}
          onChange={(event) => onHoursChange(event.target.value)}
          className="h-9"
        />
      ) : (
        <Input
          type="number"
          min={1}
          max={100}
          step={1}
          value={percentValue}
          onChange={(event) => onPercentChange(event.target.value)}
          className="h-9"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 bg-slate-50/50 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <Users2 className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Project team</h3>
          <p className="text-[11px] text-muted-foreground">
            Assign resources with weekly hours or percent. Policies for over-allocation,
            designation, and department staffing are configured in Settings.
            {thresholdMode === "approve" && (
              <span className="block mt-1 text-amber-600">
                Over-capacity assignments require PMO Lead / HR approval.
              </span>
            )}
          </p>
        </div>
      </div>

      {!hasPlanningWindow && canEdit && (
        <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {variant === "workspace"
            ? "Set project start and end dates in project settings to load team availability."
            : "Set project start and end dates above to load team availability."}
        </p>
      )}

      {projectId && hasPlanningWindow && allocationIssueMessages.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 space-y-2">
              <ul className="space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                {allocationIssueMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {projectId && hasPlanningWindow && canEdit && allocationDateIssues?.canAlign && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setAlignDialogOpen(true)}
          >
            Align active allocations to project dates
          </Button>
        </div>
      )}

      {existingTeam.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current team
          </p>
          {existingTeam.map((member) => {
            const isEditing = editingAllocationId === member.id && editDraft != null;
            const memberDateWarnings: string[] = [];
            if (
              hasPlanningWindow &&
              member.status === "Active" &&
              isAllocationNotStartedYet(member.startDate)
            ) {
              memberDateWarnings.push(
                `Cannot log hours until ${formatAllocationDateLabel(member.startDate)}.`,
              );
            }
            const blockedEditSave =
              isEditing &&
              allocationPolicy != null &&
              ((thresholdMode === "block" && editWouldOverAllocate(member)) ||
                (thresholdMode !== "block" &&
                  editWouldOverAllocate(member) &&
                  (editDraft?.overrideReason.trim().length ?? 0) < OVERRIDE_REASON_MIN) ||
                isPolicyBlocked(
                  allocationPolicy.designationMismatchMode,
                  editHasDesignationMismatch(member),
                ) ||
                isPolicyBlocked(
                  allocationPolicy.departmentStaffingMode,
                  editHasDepartmentMismatch(member),
                ));

            return (
              <div
                key={member.id}
                className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 px-3 py-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <EmployeeAvatar
                          name={member.employee.name}
                          employeeId={member.employee.id}
                          profileImageUrl={member.employee.profileImageUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.employee.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {member.employee.department.name} · {member.employee.designation}
                        </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={cancelEditingExisting}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_88px]">
                      <div className="min-w-0">
                        <ProjectRoleSelect
                          value={editDraft.role}
                          onValueChange={(role) =>
                            setEditDraft((prev) => (prev ? { ...prev, role } : prev))
                          }
                          options={designationOptions}
                          extraOptions={[member.employee.designation]}
                        />
                      </div>
                      <AllocationModeToggle
                        value={editDraft.allocationMode}
                        onChange={(mode) =>
                          setEditDraft((prev) => (prev ? { ...prev, allocationMode: mode } : prev))
                        }
                      />
                      {renderAllocationInput(
                        editDraft.allocationMode,
                        editDraft.hoursPerWeek,
                        editDraft.percentPerWeek,
                        (value) =>
                          setEditDraft((prev) => (prev ? { ...prev, hoursPerWeek: value } : prev)),
                        (value) =>
                          setEditDraft((prev) => (prev ? { ...prev, percentPerWeek: value } : prev)),
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Allocation start
                        </label>
                        <Input
                          type="date"
                          value={editDraft.startDate}
                          onChange={(event) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, startDate: event.target.value } : prev,
                            )
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Allocation end
                        </label>
                        <Input
                          type="date"
                          value={editDraft.endDate}
                          min={editDraft.startDate || undefined}
                          onChange={(event) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, endDate: event.target.value } : prev,
                            )
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                    {editWouldOverAllocate(member) && thresholdMode !== "block" && (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1 text-[11px] text-amber-600">
                          <AlertTriangle className="size-3" />
                          Over-allocation requires an authorised override reason.
                        </p>
                        <textarea
                          value={editDraft.overrideReason}
                          onChange={(event) =>
                            setEditDraft((prev) =>
                              prev
                                ? { ...prev, overrideReason: event.target.value }
                                : prev,
                            )
                          }
                          rows={2}
                          placeholder="Why is this over-allocation authorised? (min 10 characters)"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                      </div>
                    )}
                    {editWouldOverAllocate(member) && thresholdMode === "block" && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-600">
                        <AlertTriangle className="size-3" />
                        Over-allocation is blocked by policy.
                      </p>
                    )}
                    {editHasDesignationMismatch(member) && allocationPolicy && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-600">
                        <AlertTriangle className="size-3" />
                        {getDesignationMismatchMessage(
                          allocationPolicy,
                          member.employee.name,
                          editDraft.role,
                          member.employee.designation,
                        ) ?? "Role not allowed for this designation"}
                      </p>
                    )}
                    {editHasDepartmentMismatch(member) && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-600">
                        <AlertTriangle className="size-3" />
                        Employee department differs from project department
                      </p>
                    )}
                    {blockedEditSave && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-600">
                        <AlertTriangle className="size-3" />
                        Assignment blocked by allocation policy.
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={blockedEditSave || isUpdatingMember}
                      onClick={() => handleSaveExisting(member)}
                    >
                      {isUpdatingMember && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <EmployeeAvatar
                        name={member.employee.name}
                        employeeId={member.employee.id}
                        profileImageUrl={member.employee.profileImageUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate">{member.employee.name}</p>
                        {member.status === "Pending" && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                            Pending approval
                          </span>
                        )}
                        {member.kekaSyncedAt && member.status === "Active" && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                            Synced to Keka
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {member.employee.department.name} · {member.employee.designation} · {member.role}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatAllocationSummary(member)} · {member.remainingHoursTotal}h/week remaining overall
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="size-3 shrink-0" />
                        {formatAllocationDateRange(member.startDate, member.endDate)}
                      </p>
                      {memberDateWarnings.map((warning) => (
                        <p
                          key={warning}
                          className="mt-1 flex items-center gap-1 text-[11px] text-amber-600"
                        >
                          <AlertTriangle className="size-3 shrink-0" />
                          {warning}
                        </p>
                      ))}
                      {member.upcomingLeave.length > 0 && (
                        <p className="mt-1 text-[11px] text-amber-600">
                          On leave: {formatLeaveRanges(member.upcomingLeave)}
                        </p>
                      )}
                      {canEdit && projectId && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Backup
                          </label>
                          <EmployeePickerSelect
                            value={member.backupEmployeeId}
                            onValueChange={(backupEmployeeId) => {
                              void handleBackupChange(member, backupEmployeeId);
                            }}
                            options={backupOptions.filter(
                              (option) => option.id !== member.employeeId,
                            )}
                            disabled={isSettingBackup}
                            noneLabel="No backup"
                          />
                          {member.backupEmployeeName && (
                            <span className="text-[11px] text-emerald-600">
                              Current: {member.backupEmployeeName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditingExisting(member)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-rose-500 hover:text-rose-600"
                          disabled={isRemoving}
                          onClick={() => handleRemoveExisting(member.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add team members
            </label>
            <Popover
              open={pickerOpen}
              onOpenChange={(open) => {
                setPickerOpen(open);
                if (!open) {
                  setSearchVal("");
                }
              }}
            >
              <PopoverTrigger
                type="button"
                disabled={!hasPlanningWindow || loadingCandidates || (availableCandidates.length === 0 && !searchVal)}
                className={cn(
                  "flex w-full min-h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm dark:border-white/[0.08] dark:bg-zinc-950",
                  "hover:border-slate-300 dark:hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="text-muted-foreground">
                  {!hasPlanningWindow
                    ? "Set project dates first"
                    : loadingCandidates
                      ? "Loading employees..."
                      : (availableCandidates.length === 0 && !searchVal)
                        ? "No available employees"
                        : checkedCandidates.length > 0
                          ? `${checkedCandidates.length} selected — configure allocation below`
                          : "Select employees..."}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
                <div className="p-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-900/50">
                  <Input
                    placeholder="Search name, email, designation..."
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    className="h-8 text-xs w-full"
                    autoFocus
                  />
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {loadingCandidates ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="mr-2 size-4 animate-spin text-primary" />
                      Loading...
                    </div>
                  ) : availableCandidates.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No candidates found.
                    </div>
                  ) : (
                    availableCandidates.map((candidate) => {
                      const isChecked = checkedIds.includes(candidate.employeeId);

                      return (
                        <label
                          key={candidate.employeeId}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                            isChecked && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              toggleCandidate(candidate, checked === true)
                            }
                            className="mt-1"
                          />
                          <EmployeeAvatar
                            name={candidate.name}
                            employeeId={candidate.employeeId}
                            profileImageUrl={candidate.profileImageUrl}
                            size="sm"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {candidate.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {candidate.department.name} · {candidate.designation}
                            </p>
                            <p
                              className={cn(
                                "text-[11px]",
                                candidate.isOverAllocated
                                  ? "text-rose-500"
                                  : candidate.isFullyBooked
                                    ? "text-amber-600"
                                    : "text-emerald-600",
                              )}
                            >
                              {candidate.allocatedHoursTotal}h/week allocated · {availabilityLabel(candidate)}
                            </p>
                            {candidate.upcomingLeave.length > 0 && (
                              <p className="mt-1 text-[11px] text-amber-600">
                                On leave: {formatLeaveRanges(candidate.upcomingLeave)}
                              </p>
                            )}
                            {allocationPolicy?.departmentStaffingMode !== "off" &&
                              !candidate.departmentStaffingAllowed && (
                                <p className="mt-1 text-[11px] text-amber-600">
                                  Outside allowed project department
                                </p>
                              )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {checkedCandidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Selected employees
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_88px] gap-2 border-b border-slate-200 bg-slate-100/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <span>Employee</span>
                  <span>Project role</span>
                  <span>Type</span>
                  <span>Allocation</span>
                </div>
                {checkedCandidates.map((candidate) => {
                  const config = draftConfig[candidate.employeeId] ?? {
                    role: candidate.designation,
                    allocationMode: "hours" as const,
                    hoursPerWeek: DEFAULT_HOURS,
                    percentPerWeek: DEFAULT_PERCENT,
                  };
                  const wouldExceed = draftWouldOverAllocate(candidate);
                  const designationMismatch = draftHasDesignationMismatch(candidate);
                  const departmentMismatch = draftHasDepartmentMismatch(candidate);

                  return (
                    <div
                      key={candidate.employeeId}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_88px] gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0 dark:border-white/[0.08]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <EmployeeAvatar
                          name={candidate.name}
                          employeeId={candidate.employeeId}
                          profileImageUrl={candidate.profileImageUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{candidate.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {candidate.department.name} · {candidate.remainingHours}h left
                        </p>
                        {wouldExceed && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                            <AlertTriangle className="size-3" />
                            May over-allocate
                          </p>
                        )}
                        {designationMismatch && allocationPolicy && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                            <AlertTriangle className="size-3" />
                            {getDesignationMismatchMessage(
                              allocationPolicy,
                              candidate.name,
                              config.role,
                              candidate.designation,
                            ) ?? "Role not allowed for this designation"}
                          </p>
                        )}
                        {departmentMismatch && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                            <AlertTriangle className="size-3" />
                            Cross-department assignment
                          </p>
                        )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <ProjectRoleSelect
                          value={config.role}
                          onValueChange={(role) =>
                            updateDraftConfig(candidate.employeeId, { role })
                          }
                          options={designationOptions}
                          extraOptions={[candidate.designation]}
                        />
                      </div>
                      <AllocationModeToggle
                        value={config.allocationMode}
                        onChange={(mode) =>
                          updateDraftConfig(candidate.employeeId, { allocationMode: mode })
                        }
                      />
                      {renderAllocationInput(
                        config.allocationMode,
                        config.hoursPerWeek,
                        config.percentPerWeek,
                        (value) =>
                          updateDraftConfig(candidate.employeeId, { hoursPerWeek: value }),
                        (value) =>
                          updateDraftConfig(candidate.employeeId, { percentPerWeek: value }),
                      )}
                    </div>
                  );
                })}
              </div>

              {hasBlockedOverAllocation && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600">
                  <AlertTriangle className="size-3" />
                  One or more selected employees would exceed weekly capacity (blocked by policy).
                </p>
              )}
              {thresholdMode === "approve" &&
                checkedCandidates.some((candidate) => draftWouldOverAllocate(candidate)) && (
                  <p className="flex items-center gap-1 text-[11px] text-amber-600">
                    <AlertTriangle className="size-3" />
                    Over-capacity selections will be submitted for staffing approval.
                  </p>
                )}
              {needsOverrideReason && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Override reason (required)
                  </label>
                  <textarea
                    value={bulkOverrideReason}
                    onChange={(event) => setBulkOverrideReason(event.target.value)}
                    rows={2}
                    placeholder="Why is over-allocation authorised? (min 10 characters)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </div>
              )}
              {hasBlockedDesignation && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600">
                  <AlertTriangle className="size-3" />
                  One or more project roles are not allowed for the selected employees (blocked
                  by policy). Check designation rules in Settings.
                </p>
              )}
              {hasBlockedDepartment && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600">
                  <AlertTriangle className="size-3" />
                  One or more employees are outside allowed project departments (blocked by policy).
                </p>
              )}

              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={!canAddSelected || isAddingMembers}
                onClick={handleAddSelected}
              >
                {isAddingMembers && <Loader2 className="size-4 animate-spin" />}
                {projectId
                  ? `Add ${checkedCandidates.length} to project`
                  : `Add ${checkedCandidates.length} to team`}
              </Button>
            </div>
          )}
        </div>
      )}

      {pendingMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {projectId ? "To be added on save" : "Team for new project"}
          </p>
          <div className="overflow-hidden rounded-lg border border-primary/20">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_88px_40px] gap-2 border-b border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Employee</span>
              <span>Project role</span>
              <span>Type</span>
              <span>Allocation</span>
              <span />
            </div>
            {pendingMembers.map((member) => (
              <div
                key={member.employeeId}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_88px_40px] gap-2 border-b border-primary/10 bg-primary/5 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <EmployeeAvatar
                      name={member.name}
                      employeeId={member.employeeId}
                      profileImageUrl={member.profileImageUrl}
                      size="xs"
                    />
                    <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.departmentName} · {member.designation}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.remainingHours}h/week remaining before assignment
                  </p>
                  {member.isOverAllocated && (
                    <div className="mt-1 space-y-1.5">
                      <p className="flex items-center gap-1 text-[11px] text-amber-600">
                        <AlertTriangle className="size-3" />
                        This assignment may over-allocate this resource.
                      </p>
                      {canEdit && (
                        <textarea
                          value={member.overrideReason ?? ""}
                          onChange={(event) =>
                            handleUpdatePending(member.employeeId, {
                              overrideReason: event.target.value,
                            })
                          }
                          rows={2}
                          placeholder="Override reason (min 10 characters)"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
                {canEdit ? (
                  <div className="min-w-0">
                    <ProjectRoleSelect
                      value={member.role}
                      onValueChange={(role) =>
                        handleUpdatePending(member.employeeId, { role })
                      }
                      options={designationOptions}
                      extraOptions={[member.designation]}
                    />
                  </div>
                ) : (
                  <p className="self-center text-sm">{member.role}</p>
                )}
                {canEdit ? (
                  <AllocationModeToggle
                    value={member.allocationMode}
                    onChange={(mode) =>
                      handleUpdatePending(member.employeeId, { allocationMode: mode })
                    }
                  />
                ) : (
                  <p className="self-center text-sm">{member.allocationMode}</p>
                )}
                {canEdit ? (
                  renderAllocationInput(
                    member.allocationMode,
                    String(member.hoursPerWeek),
                    String(member.percentPerWeek),
                    (value) => {
                      const hours = Number(value);
                      if (!Number.isFinite(hours)) return;
                      handleUpdatePending(member.employeeId, { hoursPerWeek: hours });
                    },
                    (value) => {
                      const percent = Number(value);
                      if (!Number.isFinite(percent)) return;
                      handleUpdatePending(member.employeeId, { percentPerWeek: percent });
                    },
                  )
                ) : (
                  <p className="self-center text-sm">
                    {member.allocationMode === "percent"
                      ? `${member.percentPerWeek}%`
                      : `${member.hoursPerWeek}h`}
                  </p>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-rose-500 hover:text-rose-600"
                    onClick={() => handleRemovePending(member.employeeId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AllocationAlignDialog
        isOpen={alignDialogOpen}
        onCancel={() => setAlignDialogOpen(false)}
        onSaveWithoutAlign={() => setAlignDialogOpen(false)}
        onConfirmAlign={() => void handleAlignAllocations()}
        isAligning={isAligning}
        projectLabel="this project"
        preview={allocationDateIssues?.alignPreview ?? []}
        issueMessages={alignDialogIssueMessages}
      />
    </div>
  );
});
