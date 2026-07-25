"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Layers,
  XCircle,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import type {
  Customer,
  Department,
  ProjectManager,
} from "../../types/projects.types";
import type { MppImportPreviewTask } from "../../types/mpp-import.types";
import {
  BILLING_OPTIONS,
  CURRENCY_OPTIONS,
  ENGAGEMENT_OPTIONS,
  PRIORITY_CONFIG,
  PRIORITY_OPTIONS,
  TASK_STATUS_CONFIG,
} from "../list/import-types-helpers";

export type MppEditableProject = {
  name: string;
  importMode: "create" | "update";
  resolvedProjectId?: string;
  objective: string;
  departmentId: string;
  customerId: string;
  primaryPmId: string;
  engagementType: string;
  billingModel: string;
  priority: string;
  currency: string;
  value: string;
  startDate?: string;
  finishDate?: string;
  taskCount: number;
  phaseCount: number;
  dependencyCount: number;
  tasks: MppImportPreviewTask[];
  errors: string[];
  warnings: string[];
};

type Props = {
  projects: MppEditableProject[];
  departments: Department[];
  customers: Customer[];
  managers: ProjectManager[];
  onProjectChange: (
    index: number,
    field: keyof MppEditableProject,
    value: string,
  ) => void;
  /** When true, hide the editable projects metadata table (workspace import). */
  hideProjectEditors?: boolean;
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : value.slice(0, 10);
}

const selectClassName =
  "h-8 w-full appearance-none truncate rounded-lg border border-border bg-background py-1 pl-2 pr-8 text-xs font-medium disabled:opacity-60";

function PreviewSelect({
  disabled,
  value,
  onChange,
  children,
  className,
}: {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function groupTasksByPhase(tasks: MppImportPreviewTask[]) {
  const order: string[] = [];
  const map = new Map<string, MppImportPreviewTask[]>();
  for (const task of tasks) {
    const phase = task.phaseName?.trim() || "No Phase";
    if (!map.has(phase)) {
      order.push(phase);
      map.set(phase, []);
    }
    map.get(phase)!.push(task);
  }
  return order.map((phase) => ({ phase, tasks: map.get(phase)! }));
}

export function MppImportPreviewPanel({
  projects,
  departments,
  customers,
  managers,
  onProjectChange,
  hideProjectEditors = false,
}: Props) {
  const [openAccordion, setOpenAccordion] = useState<string | null>(
    projects[0]?.name ?? null,
  );
  const [activeTab, setActiveTab] = useState<Record<string, "phases" | "tasks">>(
    {},
  );

  const readyCount = useMemo(
    () => projects.filter((p) => p.errors.length === 0).length,
    [projects],
  );

  return (
    <div className="flex flex-col gap-6">
      {!hideProjectEditors && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Projects
            </h3>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {readyCount} of {projects.length} ready
            </span>
          </div>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="max-h-[32vh] w-full overflow-auto">
              <div className="min-w-[1600px]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="w-52 p-3">Validation</th>
                      <th className="w-56 p-3">Project</th>
                      <th className="w-48 p-3">Department</th>
                      <th className="w-48 p-3">Customer</th>
                      <th className="w-44 p-3">Engagement</th>
                      <th className="w-40 p-3">Billing</th>
                      <th className="w-36 p-3">Priority</th>
                      <th className="w-48 p-3">Primary PM</th>
                      <th className="w-44 p-3">Budget</th>
                      <th className="w-56 p-3">Objective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {projects.map((row, idx) => {
                      const hasErrors = row.errors.length > 0;
                      const locked = row.importMode === "update";
                      return (
                        <tr
                          key={row.name}
                          className={cn(
                            "transition-colors hover:bg-muted/10",
                            hasErrors && "bg-rose-50/20 dark:bg-rose-950/5",
                          )}
                        >
                          <td className="p-3">
                            <div className="flex items-start gap-2">
                              {hasErrors ? (
                                <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                              ) : row.warnings.length > 0 ? (
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                              ) : (
                                <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                              )}
                              <div className="space-y-1">
                                {row.errors.map((err) => (
                                  <p
                                    key={err}
                                    className="text-[10px] font-bold leading-snug text-rose-600 dark:text-rose-400"
                                  >
                                    {err}
                                  </p>
                                ))}
                                {row.warnings.map((warn) => (
                                  <p
                                    key={warn}
                                    className="text-[10px] font-semibold leading-snug text-amber-600 dark:text-amber-400"
                                  >
                                    {warn}
                                  </p>
                                ))}
                                {!hasErrors && row.warnings.length === 0 && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    Ready
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex max-w-56 flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-bold text-foreground">
                                  {row.name}
                                </span>
                                {row.importMode === "update" ? (
                                  <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                    UPDATE
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDate(row.startDate)} → {formatDate(row.finishDate)}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.departmentId}
                              onChange={(value) =>
                                onProjectChange(idx, "departmentId", value)
                              }
                            >
                              <option value="">Select department</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.customerId}
                              onChange={(value) =>
                                onProjectChange(idx, "customerId", value)
                              }
                            >
                              <option value="">Select customer</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.displayName}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.engagementType}
                              onChange={(value) =>
                                onProjectChange(idx, "engagementType", value)
                              }
                            >
                              {ENGAGEMENT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.billingModel}
                              onChange={(value) =>
                                onProjectChange(idx, "billingModel", value)
                              }
                            >
                              {BILLING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.priority}
                              onChange={(value) =>
                                onProjectChange(idx, "priority", value)
                              }
                            >
                              {PRIORITY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <PreviewSelect
                              disabled={locked}
                              value={row.primaryPmId}
                              onChange={(value) =>
                                onProjectChange(idx, "primaryPmId", value)
                              }
                            >
                              <option value="">Select PM</option>
                              {managers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.displayName}
                                </option>
                              ))}
                            </PreviewSelect>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <PreviewSelect
                                disabled={locked}
                                value={row.currency}
                                onChange={(value) =>
                                  onProjectChange(idx, "currency", value)
                                }
                                className="w-20 shrink-0"
                              >
                                {CURRENCY_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </PreviewSelect>
                              <input
                                disabled={locked}
                                type="number"
                                min={0}
                                value={row.value}
                                onChange={(e) =>
                                  onProjectChange(idx, "value", e.target.value)
                                }
                                className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-xs font-medium disabled:opacity-60"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              disabled={locked}
                              value={row.objective}
                              onChange={(e) =>
                                onProjectChange(idx, "objective", e.target.value)
                              }
                              className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-medium disabled:opacity-60"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Phases, Tasks &amp; Schedule
        </h3>
        <div className="space-y-3">
          {projects.map((proj) => {
            const isExpanded = openAccordion === proj.name;
            const tab = activeTab[proj.name] || "tasks";
            const phaseGroups = groupTasksByPhase(proj.tasks);
            return (
              <div
                key={proj.name}
                className="overflow-hidden rounded-xl border border-border/80 bg-muted/5"
              >
                <button
                  type="button"
                  onClick={() => setOpenAccordion(isExpanded ? null : proj.name)}
                  className="flex w-full cursor-pointer items-center justify-between border-b border-border/60 bg-muted/20 p-4 text-left transition hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <FolderOpen className="size-4.5 shrink-0 text-primary" />
                    <span className="text-xs font-bold text-foreground">{proj.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-[10px] font-semibold">
                      <Layers className="size-3" />
                      {proj.phaseCount} Phases
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px] font-semibold">
                      <CheckSquare className="size-3" />
                      {proj.taskCount} Tasks
                    </Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="flex flex-col gap-4 p-4">
                    <div className="flex gap-2 border-b border-border">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab((prev) => ({ ...prev, [proj.name]: "phases" }))
                        }
                        className={cn(
                          "cursor-pointer border-b-2 px-3 pb-2 text-xs font-bold transition-colors",
                          tab === "phases"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Phases ({phaseGroups.length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab((prev) => ({ ...prev, [proj.name]: "tasks" }))
                        }
                        className={cn(
                          "cursor-pointer border-b-2 px-3 pb-2 text-xs font-bold transition-colors",
                          tab === "tasks"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Tasks ({proj.tasks.length})
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      {tab === "phases" ? (
                        <table className="w-full min-w-[900px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                              <th className="w-40 p-3">Validation</th>
                              <th className="w-56 p-3">Phase</th>
                              <th className="w-28 p-3">Tasks</th>
                              <th className="w-36 p-3">Start</th>
                              <th className="w-36 p-3">End</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {phaseGroups.map((group) => {
                              const starts = group.tasks
                                .map((t) => t.startDate)
                                .filter(Boolean)
                                .sort();
                              const ends = group.tasks
                                .map((t) => t.finishDate)
                                .filter(Boolean)
                                .sort();
                              return (
                                <tr key={group.phase} className="hover:bg-muted/5">
                                  <td className="p-3">
                                    <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                                      <CheckCircle className="size-3.5" />
                                      Ready
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                      <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">
                                        NEW
                                      </span>
                                      <span className="truncate">{group.phase}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-muted-foreground">
                                    {group.tasks.length}
                                  </td>
                                  <td className="p-3">{formatDate(starts[0])}</td>
                                  <td className="p-3">
                                    {formatDate(ends[ends.length - 1])}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full min-w-[1100px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                              <th className="w-36 p-3">Validation</th>
                              <th className="w-64 p-3">Title</th>
                              <th className="w-32 p-3">Priority</th>
                              <th className="w-36 p-3">Status</th>
                              <th className="w-48 p-3">Phase</th>
                              <th className="w-36 p-3">Start</th>
                              <th className="w-36 p-3">End</th>
                              <th className="w-28 p-3">Effort</th>
                            </tr>
                          </thead>
                          <tbody>
                            {phaseGroups.map((group) => (
                              <React.Fragment key={group.phase}>
                                <tr className="bg-primary/5">
                                  <td colSpan={8} className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Layers className="size-3.5 text-primary" />
                                      <span className="text-[11px] font-bold text-primary">
                                        {group.phase}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {group.tasks.length} task
                                        {group.tasks.length === 1 ? "" : "s"}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {group.tasks.map((task) => {
                                  const progress = task.percentComplete ?? 0;
                                  const statusKey =
                                    progress >= 100
                                      ? "Done"
                                      : progress > 0
                                        ? "In_Progress"
                                        : "To_Do";
                                  const status = TASK_STATUS_CONFIG[statusKey];
                                  const priority = PRIORITY_CONFIG.Medium;
                                  const effort =
                                    task.durationDays != null
                                      ? `${task.durationDays * 8} hrs`
                                      : "—";
                                  return (
                                    <tr
                                      key={`${proj.name}-${task.uid}`}
                                      className="border-t border-border/50 hover:bg-muted/5"
                                    >
                                      <td className="p-3">
                                        <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                                          <CheckCircle className="size-3.5" />
                                          Ready
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <div className="flex items-center gap-1.5 font-bold">
                                          <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">
                                            NEW
                                          </span>
                                          <span className="truncate">{task.name}</span>
                                        </div>
                                        {task.hasParent && (
                                          <div className="text-[10px] text-muted-foreground">
                                            Nested task
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        <span
                                          className={cn(
                                            "rounded border px-1.5 py-0.5 text-[9px] font-bold",
                                            priority.bg,
                                            priority.text,
                                          )}
                                        >
                                          Medium
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <span
                                          className={cn(
                                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                            status.bg,
                                            status.text,
                                            status.border,
                                          )}
                                        >
                                          <span
                                            className={cn("size-1.5 rounded-full", status.dot)}
                                          />
                                          {status.label}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <span className="font-medium text-primary underline-offset-2 hover:underline">
                                          {task.phaseName || "—"}
                                        </span>
                                      </td>
                                      <td className="p-3">{formatDate(task.startDate)}</td>
                                      <td className="p-3">{formatDate(task.finishDate)}</td>
                                      <td className="p-3 text-muted-foreground">{effort}</td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                            {proj.tasks.length === 0 && (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="p-6 text-center text-muted-foreground"
                                >
                                  No importable tasks in this project.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
