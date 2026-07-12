"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { useGetDepartmentsQuery } from "@/domains/projects/api/projects.api";
import { useGetDesignationOptionsQuery } from "@/domains/resources/api/resources.api";
import {
  DesignationMultiSelect,
  ProjectRoleSelect,
} from "@/shared/components/designation-select";
import type {
  DesignationRule,
  DepartmentStaffingRules,
  PolicyEnforcementMode,
  ThresholdMode,
} from "@/domains/resources/types/allocation-policy.types";
import {
  useGetAllocationPoliciesQuery,
  useUpdateAllocationPoliciesMutation,
} from "../api/settings.api";

type AllocationPoliciesSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const MODE_OPTIONS: { value: PolicyEnforcementMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "warn", label: "Warn" },
  { value: "block", label: "Block" },
];

const THRESHOLD_OPTIONS: { value: ThresholdMode; label: string }[] = [
  { value: "warn", label: "Warn" },
  { value: "block", label: "Block" },
  { value: "approve", label: "Require approval" },
];

function emptyRule(): DesignationRule {
  return { projectRole: "", allowedDesignations: [] };
}

type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

function DepartmentAllowListPicker({
  value,
  onChange,
  departments,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  departments: DepartmentOption[];
}) {
  const selected = new Set(value.map((code) => code.toUpperCase()));
  const selectedDepartments = departments.filter((dept) =>
    selected.has(dept.code.toUpperCase()),
  );

  const toggleCode = (code: string, checked: boolean) => {
    const normalized = code.toUpperCase();
    if (checked) {
      onChange([...value.filter((item) => item.toUpperCase() !== normalized), normalized]);
      return;
    }
    onChange(value.filter((item) => item.toUpperCase() !== normalized));
  };

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-xs",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedDepartments.length === 0 ? (
            <span className="text-muted-foreground">Select allowed departments…</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selectedDepartments.map((dept) => (
                <span
                  key={dept.id}
                  className="inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  <span className="truncate">{dept.code}</span>
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[var(--anchor-width)] p-0">
        <div className="max-h-64 overflow-y-auto p-2">
          {departments.map((dept) => {
            const isChecked = selected.has(dept.code.toUpperCase());
            return (
              <label
                key={dept.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/50",
                  isChecked && "bg-primary/5",
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleCode(dept.code, checked === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{dept.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {dept.code}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AllocationPoliciesSection({
  onSuccess,
  onError,
}: AllocationPoliciesSectionProps) {
  const { data, isLoading, isError, error } = useGetAllocationPoliciesQuery();
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: designationOptionsData } = useGetDesignationOptionsQuery();
  const designationOptions = designationOptionsData?.options ?? [];
  const [updatePolicies, { isLoading: isSaving }] =
    useUpdateAllocationPoliciesMutation();
  const loadErrorNotified = useRef(false);

  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>("warn");
  const [designationMismatchMode, setDesignationMismatchMode] =
    useState<PolicyEnforcementMode>("warn");
  const [departmentStaffingMode, setDepartmentStaffingMode] =
    useState<PolicyEnforcementMode>("off");
  const [designationRules, setDesignationRules] = useState<DesignationRule[]>([]);
  const [departmentRule, setDepartmentRule] =
    useState<DepartmentStaffingRules["rule"]>("same_department_only");
  const [allowList, setAllowList] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!data) return;
    setThresholdMode(data.thresholdMode);
    setDesignationMismatchMode(data.designationMismatchMode);
    setDepartmentStaffingMode(data.departmentStaffingMode);
    setDesignationRules(data.designationRules);
    setDepartmentRule(data.departmentStaffingRules.rule);
    const nextAllowList: Record<string, string[]> = {};
    for (const dept of departments) {
      const codes =
        data.departmentStaffingRules.byProjectDepartmentCode?.[dept.code] ??
        (data.departmentStaffingRules.rule === "allow_list" ? [dept.code] : []);
      nextAllowList[dept.code] = codes.map((code) => code.toUpperCase());
    }
    setAllowList(nextAllowList);
    loadErrorNotified.current = false;
  }, [data, departments]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(
        error,
        "Could not load allocation policies. Check your permissions and try again.",
      ),
    );
  }, [isError, error, onError]);

  const handleSave = async () => {
    const parsedRules = designationRules
      .map((rule) => ({
        projectRole: rule.projectRole.trim(),
        allowedDesignations: rule.allowedDesignations
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      .filter(
        (rule) => rule.projectRole.length > 0 && rule.allowedDesignations.length > 0,
      );

    const departmentStaffingRules: DepartmentStaffingRules =
      departmentRule === "allow_list"
        ? {
            rule: "allow_list",
            byProjectDepartmentCode: Object.fromEntries(
              departments.map((dept) => [
                dept.code,
                (allowList[dept.code] ?? [dept.code]).map((code) => code.toUpperCase()),
              ]),
            ),
          }
        : { rule: "same_department_only" };

    try {
      await updatePolicies({
        thresholdMode,
        designationMismatchMode,
        departmentStaffingMode,
        designationRules: parsedRules,
        departmentStaffingRules,
      }).unwrap();
      onSuccess("Resource allocation policies saved.");
    } catch (err) {
      onError(
        getApiErrorMessage(err, "Could not save allocation policies."),
      );
    }
  };

  if (isLoading && !data) {
    return (
      <p className="text-sm text-muted-foreground">Loading allocation policies…</p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Over-allocation threshold</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            When a project assignment would push an employee above their weekly capacity,
            choose whether to warn, block the assignment, or send it to the approval queue.
          </p>
        </div>
        <Select
          value={thresholdMode}
          onValueChange={(value) => setThresholdMode(value as ThresholdMode)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THRESHOLD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Designation mismatch</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Controls what happens when someone&apos;s <strong>project role</strong> does not
            match their <strong>HR designation</strong> from Keka. Use Off to ignore, Warn to
            allow with a warning, or Block to stop the assignment.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Enforcement
          </p>
          <Select
            value={designationMismatchMode}
            onValueChange={(value) =>
              setDesignationMismatchMode(value as PolicyEnforcementMode)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 border-t border-border/60 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Designation rules</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Optional exceptions. Each row says: for this <strong>project role</strong>,
                which <strong>HR designations</strong> may be assigned. Example: project role
                &quot;Team Lead&quot; may be filled by people designated &quot;Team Lead&quot; or
                &quot;Security Consultant&quot;. If you add no rules, project role must exactly
                match HR designation. If a rule exists, only the listed designations are allowed
                for that role.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setDesignationRules((prev) => [...prev, emptyRule()])}
            >
              <Plus className="size-3.5" />
              Add rule
            </Button>
          </div>

          {designationRules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
              No custom rules — project role must match employee HR designation exactly.
            </p>
          ) : (
            <div className="space-y-2">
              {designationRules.map((rule, index) => (
                <div
                  key={`rule-${index}`}
                  className="space-y-2 rounded-lg border border-border/60 p-3"
                >
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Project role
                      </p>
                      <ProjectRoleSelect
                        value={rule.projectRole}
                        onValueChange={(projectRole) =>
                          setDesignationRules((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, projectRole } : row,
                            ),
                          )
                        }
                        options={designationOptions}
                        extraOptions={rule.allowedDesignations}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Allowed HR designations
                      </p>
                      <DesignationMultiSelect
                        value={rule.allowedDesignations}
                        onChange={(allowedDesignations) =>
                          setDesignationRules((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, allowedDesignations } : row,
                            ),
                          )
                        }
                        options={designationOptions}
                        extraOptions={[rule.projectRole, ...rule.allowedDesignations]}
                        placeholder="Who may be assigned this project role…"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 self-end"
                      onClick={() =>
                        setDesignationRules((prev) =>
                          prev.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="size-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Department staffing</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Controls what happens when an employee&apos;s <strong>home department</strong> (from
            Keka) differs from the <strong>project&apos;s owning department</strong>. Use Off to
            ignore, Warn to allow with a warning, or Block to stop the assignment.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Enforcement
          </p>
          <Select
            value={departmentStaffingMode}
            onValueChange={(value) =>
              setDepartmentStaffingMode(value as PolicyEnforcementMode)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {departmentStaffingMode !== "off" && (
          <div className="space-y-4 border-t border-border/60 pt-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Department staffing rule</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Choose how cross-department staffing is evaluated. &quot;Same department
                only&quot; requires employee and project departments to match. &quot;Allow-list
                matrix&quot; lets you define which employee departments may work on each project
                department.
              </p>
            </div>
            <Select
              value={departmentRule}
              onValueChange={(value) =>
                setDepartmentRule(value as DepartmentStaffingRules["rule"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same_department_only">Same department only</SelectItem>
                <SelectItem value="allow_list">Allow-list matrix</SelectItem>
              </SelectContent>
            </Select>

            {departmentRule === "allow_list" && (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Cross-department allow list</p>
                  <p className="text-xs text-muted-foreground">
                    Each row is a <strong>project owning department</strong>. Select which{" "}
                    <strong>employee departments</strong> may be staffed on those projects.
                    Example: for APPSEC projects, select CLOUD and APPSEC to allow both teams.
                  </p>
                </div>
                <div className="hidden gap-3 border-b border-border/50 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
                  <span>Project department</span>
                  <span>Allowed employee departments</span>
                </div>
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="grid gap-2 rounded-lg border border-border/60 bg-background p-3 sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{dept.name}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {dept.code}
                        </p>
                      </div>
                      <DepartmentAllowListPicker
                        value={allowList[dept.code] ?? [dept.code]}
                        onChange={(codes) =>
                          setAllowList((prev) => ({
                            ...prev,
                            [dept.code]: codes,
                          }))
                        }
                        departments={departments}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Button type="button" className="gap-2" disabled={isSaving} onClick={handleSave}>
        <Save className="size-4" />
        Save allocation policies
      </Button>
    </div>
  );
}
