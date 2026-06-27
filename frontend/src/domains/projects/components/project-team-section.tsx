"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Trash2, Users2 } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useAddProjectTeamMembersMutation,
  useGetTeamCandidatesQuery,
  useGetProjectTeamQuery,
  useRemoveProjectTeamMemberMutation,
  type PendingTeamMember,
  type TeamCandidate,
} from "@/domains/projects";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface ProjectTeamSectionProps {
  projectId?: string | null;
  departmentId?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  pendingMembers: PendingTeamMember[];
  onPendingMembersChange: (members: PendingTeamMember[]) => void;
  canEdit?: boolean;
  filterByDepartment?: boolean;
}

interface DraftMemberConfig {
  role: string;
  hoursPerWeek: string;
}

const DEFAULT_HOURS = "20";

function formatDateValue(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function availabilityLabel(candidate: TeamCandidate): string {
  if (candidate.isOverAllocated) return "Over-allocated";
  if (candidate.isFullyBooked) return "Fully booked";
  return `${candidate.remainingHours}h remaining`;
}

function buildPendingMember(
  candidate: TeamCandidate,
  role: string,
  hours: number,
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): PendingTeamMember {
  const wouldExceed =
    candidate.allocatedHoursTotal + hours > candidate.weeklyCapacityHours;

  return {
    employeeId: candidate.employeeId,
    name: candidate.name,
    departmentName: candidate.department.name,
    designation: candidate.designation,
    role: role.trim(),
    hoursPerWeek: hours,
    startDate: formatDateValue(startDate) ?? new Date().toISOString().slice(0, 10),
    endDate: formatDateValue(endDate),
    remainingHours: candidate.remainingHours,
    isOverAllocated: wouldExceed,
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
    if (!config?.role.trim()) continue;

    const hours = Number(config.hoursPerWeek);
    if (!Number.isFinite(hours) || hours <= 0) continue;

    members.push(buildPendingMember(candidate, config.role, hours, startDate, endDate));
  }

  return members;
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
  },
  ref,
) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [draftConfig, setDraftConfig] = useState<Record<string, DraftMemberConfig>>({});

  const { data: existingTeam = [], refetch: refetchTeam } = useGetProjectTeamQuery(
    projectId ?? "",
    { skip: !projectId },
  );

  const [removeMember, { isLoading: isRemoving }] = useRemoveProjectTeamMemberMutation();
  const [addProjectTeamMembers, { isLoading: isAddingMembers }] =
    useAddProjectTeamMembersMutation();

  const candidateQuery = useMemo(
    () => ({
      departmentId: filterByDepartment && departmentId ? departmentId : undefined,
      projectId: projectId ?? undefined,
    }),
    [departmentId, filterByDepartment, projectId],
  );

  const { data: candidates = [], isLoading: loadingCandidates } =
    useGetTeamCandidatesQuery(candidateQuery);

  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    existingTeam.forEach((row) => ids.add(row.employeeId));
    pendingMembers.forEach((row) => ids.add(row.employeeId));
    return ids;
  }, [existingTeam, pendingMembers]);

  const availableCandidates = candidates.filter(
    (candidate) => !assignedEmployeeIds.has(candidate.employeeId),
  );

  const checkedCandidates = useMemo(
    () =>
      checkedIds
        .map((id) => availableCandidates.find((candidate) => candidate.employeeId === id))
        .filter((candidate): candidate is TeamCandidate => Boolean(candidate)),
    [availableCandidates, checkedIds],
  );

  useImperativeHandle(
    ref,
    () => ({
      collectMembersToSave: () =>
        buildDraftMembers(checkedCandidates, draftConfig, startDate, endDate),
    }),
    [checkedCandidates, draftConfig, startDate, endDate],
  );

  const toggleCandidate = (candidate: TeamCandidate, checked: boolean) => {
    if (checked) {
      setCheckedIds((prev) => [...prev, candidate.employeeId]);
      setDraftConfig((prev) => ({
        ...prev,
        [candidate.employeeId]: {
          role: candidate.designation,
          hoursPerWeek: DEFAULT_HOURS,
        },
      }));
      return;
    }

    setCheckedIds((prev) => prev.filter((id) => id !== candidate.employeeId));
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
        hoursPerWeek: prev[employeeId]?.hoursPerWeek ?? DEFAULT_HOURS,
        ...patch,
      },
    }));
  };

  const handleAddSelected = async () => {
    const draftMembers = buildDraftMembers(
      checkedCandidates,
      draftConfig,
      startDate,
      endDate,
    );
    if (draftMembers.length === 0) return;

    if (projectId) {
      try {
        const teamResult = await addProjectTeamMembers({
          projectId,
          body: {
            allocations: draftMembers.map((member) => ({
              employeeId: member.employeeId,
              role: member.role,
              hours: member.hoursPerWeek,
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
        setDraftConfig({});
        setPickerOpen(false);
        refetchTeam();
      } catch (err: unknown) {
        const apiError = err as { data?: { message?: string } };
        toast.error(apiError?.data?.message ?? "Failed to add team members.");
      }
      return;
    }

    onPendingMembersChange([...pendingMembers, ...draftMembers]);
    setCheckedIds([]);
    setDraftConfig({});
    setPickerOpen(false);
  };

  const handleRemovePending = (employeeId: string) => {
    onPendingMembersChange(pendingMembers.filter((member) => member.employeeId !== employeeId));
  };

  const handleUpdatePending = (
    employeeId: string,
    patch: Partial<Pick<PendingTeamMember, "role" | "hoursPerWeek">>,
  ) => {
    onPendingMembersChange(
      pendingMembers.map((member) => {
        if (member.employeeId !== employeeId) return member;

        const updated = { ...member, ...patch };
        if (patch.hoursPerWeek !== undefined) {
          const candidate = candidates.find((row) => row.employeeId === employeeId);
          if (candidate) {
            updated.isOverAllocated =
              candidate.allocatedHoursTotal + patch.hoursPerWeek >
              candidate.weeklyCapacityHours;
          }
        }

        return updated;
      }),
    );
  };

  const handleRemoveExisting = async (allocationId: string) => {
    if (!projectId) return;
    await removeMember({ projectId, allocationId }).unwrap();
    refetchTeam();
  };

  const canAddSelected =
    checkedCandidates.length > 0 &&
    checkedCandidates.every((candidate) => {
      const config = draftConfig[candidate.employeeId];
      const hours = Number(config?.hoursPerWeek);
      return Boolean(config?.role.trim()) && Number.isFinite(hours) && hours > 0;
    });

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 bg-slate-50/50 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <Users2 className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Project team</h3>
          <p className="text-[11px] text-muted-foreground">
            Select one or more employees and set weekly hours for each before adding to the project.
          </p>
        </div>
      </div>

      {existingTeam.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current team
          </p>
          {existingTeam.map((member) => (
            <div
              key={member.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{member.employee.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {member.employee.department.name} · {member.employee.designation} · {member.role}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {member.hours ?? 0}h/wk on this project · {member.remainingHoursTotal}h/wk remaining overall
                </p>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-rose-500 hover:text-rose-600"
                  disabled={isRemoving}
                  onClick={() => handleRemoveExisting(member.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add team members
            </label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                type="button"
                disabled={loadingCandidates || availableCandidates.length === 0}
                className={cn(
                  "flex w-full min-h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm dark:border-white/[0.08] dark:bg-zinc-950",
                  "hover:border-slate-300 dark:hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="text-muted-foreground">
                  {loadingCandidates
                    ? "Loading employees..."
                    : availableCandidates.length === 0
                      ? "No available employees"
                      : checkedCandidates.length > 0
                        ? `${checkedCandidates.length} selected — configure hours below`
                        : "Select employees..."}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
                <div className="max-h-72 overflow-y-auto p-2">
                  {availableCandidates.map((candidate) => {
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
                            {candidate.allocatedHoursTotal}h/wk allocated · {availabilityLabel(candidate)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
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
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px] gap-2 border-b border-slate-200 bg-slate-100/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <span>Employee</span>
                  <span>Project role</span>
                  <span>Hours / wk</span>
                </div>
                {checkedCandidates.map((candidate) => {
                  const config = draftConfig[candidate.employeeId] ?? {
                    role: candidate.designation,
                    hoursPerWeek: DEFAULT_HOURS,
                  };
                  const hours = Number(config.hoursPerWeek);
                  const wouldExceed =
                    Number.isFinite(hours) &&
                    candidate.allocatedHoursTotal + hours > candidate.weeklyCapacityHours;

                  return (
                    <div
                      key={candidate.employeeId}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px] gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0 dark:border-white/[0.08]"
                    >
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
                      </div>
                      <Input
                        value={config.role}
                        onChange={(event) =>
                          updateDraftConfig(candidate.employeeId, { role: event.target.value })
                        }
                        placeholder="Project role"
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={config.hoursPerWeek}
                        onChange={(event) =>
                          updateDraftConfig(candidate.employeeId, {
                            hoursPerWeek: event.target.value,
                          })
                        }
                        className="h-9"
                      />
                    </div>
                  );
                })}
              </div>

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
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_40px] gap-2 border-b border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Employee</span>
              <span>Project role</span>
              <span>Hours / wk</span>
              <span />
            </div>
            {pendingMembers.map((member) => (
              <div
                key={member.employeeId}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_40px] gap-2 border-b border-primary/10 bg-primary/5 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.departmentName} · {member.designation}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.remainingHours}h/wk remaining before assignment
                  </p>
                  {member.isOverAllocated && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangle className="size-3" />
                      This assignment may over-allocate this resource.
                    </p>
                  )}
                </div>
                {canEdit ? (
                  <Input
                    value={member.role}
                    onChange={(event) =>
                      handleUpdatePending(member.employeeId, { role: event.target.value })
                    }
                    className="h-9"
                  />
                ) : (
                  <p className="self-center text-sm">{member.role}</p>
                )}
                {canEdit ? (
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={member.hoursPerWeek}
                    onChange={(event) => {
                      const hours = Number(event.target.value);
                      if (!Number.isFinite(hours)) return;
                      handleUpdatePending(member.employeeId, { hoursPerWeek: hours });
                    }}
                    className="h-9"
                  />
                ) : (
                  <p className="self-center text-sm">{member.hoursPerWeek}h</p>
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
    </div>
  );
});
