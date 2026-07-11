import React from "react";
import { Department, Customer, ProjectManager } from "../../types/projects.types";
import { ParsedProjectRow } from "../../utils/import-export";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  ENGAGEMENT_OPTIONS,
  BILLING_OPTIONS,
  PRIORITY_OPTIONS,
  CURRENCY_OPTIONS,
  STATUS_OPTIONS,
  isEngagementValid,
  isBillingValid,
  isPriorityValid,
  isCurrencyValid,
  isStatusValid,
  formatBudget,
  EnumSelect,
} from "./import-types-helpers";

interface ProjectsPreviewTableProps {
  parsedRows: ParsedProjectRow[];
  departments: Department[];
  customers: Customer[];
  managers: ProjectManager[];
  handleInlineChange: (index: number, field: keyof ParsedProjectRow, value: any) => void;
}

export function ProjectsPreviewTable({
  parsedRows,
  departments,
  customers,
  managers,
  handleInlineChange,
}: ProjectsPreviewTableProps) {
  return (
    <div className="border border-border rounded-xl flex flex-col bg-card">
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[35vh]">
        <div className="min-w-[2000px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase tracking-wider text-[10px] sticky top-0 z-10">
                <th className="p-3 w-64">Validation</th>
                <th className="p-3 w-60">Project Name & Objective</th>
                <th className="p-3 w-48">Department</th>
                <th className="p-3 w-48">Customer</th>
                <th className="p-3 w-48">Engagement Type</th>
                <th className="p-3 w-44">Billing Model</th>
                <th className="p-3 w-40">Priority</th>
                <th className="p-3 w-48">Primary PM</th>
                <th className="p-3 w-48">Secondary PM</th>
                <th className="p-3 w-48">Timeline (Start / End)</th>
                <th className="p-3 w-52">Budget (Currency / Value)</th>
                <th className="p-3 w-40">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {parsedRows.map((row, idx) => {
                const hasRowErrors = row.errors.length > 0;
                const hasRowWarnings = row.warnings.length > 0;

                return (
                  <tr
                    key={idx}
                    className={cn(
                      "hover:bg-muted/10 transition-colors",
                      hasRowErrors ? "bg-rose-50/20 dark:bg-rose-950/5" : ""
                    )}
                  >
                    {/* Validation Column */}
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        {hasRowErrors ? (
                          <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                        ) : hasRowWarnings ? (
                          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          {row.errors.map((err, i) => (
                            <p key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-bold leading-snug">
                              {err}
                            </p>
                          ))}
                          {row.warnings.map((warn, i) => (
                            <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-snug">
                              {warn}
                            </p>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Details */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1 w-56">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground truncate">
                            {row.name || <span className="italic text-rose-400">Missing Name</span>}
                          </span>
                          {row.importMode === "update" ? (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                              UPDATE
                            </span>
                          ) : (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {row.objective || "No objective"}
                        </div>
                      </div>
                    </td>


                    {/* Department Dropdown */}
                    <td className="p-3">
                      <select
                        value={row.resolvedDepartmentId || ""}
                        onChange={(e) =>
                          handleInlineChange(idx, "resolvedDepartmentId", e.target.value)
                        }
                        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                      >
                        {!row.resolvedDepartmentId && (
                          <option value="" disabled className="text-rose-500 font-bold">
                            {row.departmentName || "Select Department"}
                          </option>
                        )}
                        {departments.map((d: Department) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Customer Dropdown */}
                    <td className="p-3">
                      <select
                        value={row.resolvedCustomerId || ""}
                        onChange={(e) =>
                          handleInlineChange(idx, "resolvedCustomerId", e.target.value)
                        }
                        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                      >
                        {!row.resolvedCustomerId && (
                          <option value="" disabled className="text-rose-500 font-bold">
                            {row.customerName || "Select Customer"}
                          </option>
                        )}
                        {customers.map((c: Customer) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Engagement Type */}
                    <td className="p-3">
                      {isEngagementValid(row.engagementType) ? (
                        <span className="text-xs font-medium text-foreground">
                          {row.engagementType === "FixedPrice" && "Fixed Price"}
                          {row.engagementType === "ManagedServices" && "Managed Services"}
                          {row.engagementType === "StaffAugmentation" && "Staff Augmentation"}
                        </span>
                      ) : (
                        <EnumSelect
                          value={row.engagementType}
                          options={ENGAGEMENT_OPTIONS}
                          onChange={(val) => handleInlineChange(idx, "engagementType", val)}
                          placeholder="Select Type"
                        />
                      )}
                    </td>

                    {/* Billing Model */}
                    <td className="p-3">
                      {isBillingValid(row.billingModel) ? (
                        <span className="text-xs font-medium text-foreground">
                          {row.billingModel === "FixedPrice" && "Fixed Price"}
                          {row.billingModel === "TimeAndMaterial" && "Time & Material"}
                          {row.billingModel === "Retainer" && "Retainer"}
                        </span>
                      ) : (
                        <EnumSelect
                          value={row.billingModel}
                          options={BILLING_OPTIONS}
                          onChange={(val) => handleInlineChange(idx, "billingModel", val)}
                          placeholder="Select Billing"
                        />
                      )}
                    </td>

                    {/* Priority */}
                    <td className="p-3">
                      {isPriorityValid(row.priority) ? (
                        (() => {
                          const priorityCfg = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.Medium;
                          return (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border border-current/10 w-fit", priorityCfg.bg, priorityCfg.text)}>
                              {priorityCfg.label}
                            </span>
                          );
                        })()
                      ) : (
                        <EnumSelect
                          value={row.priority}
                          options={PRIORITY_OPTIONS}
                          onChange={(val) => handleInlineChange(idx, "priority", val)}
                          placeholder="Select Priority"
                        />
                      )}
                    </td>

                    {/* Primary PM Dropdown */}
                    <td className="p-3">
                      <select
                        value={row.resolvedPrimaryPmId || ""}
                        onChange={(e) =>
                          handleInlineChange(idx, "resolvedPrimaryPmId", e.target.value)
                        }
                        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                      >
                        {!row.resolvedPrimaryPmId && (
                          <option value="" disabled className="text-rose-500 font-bold">
                            {row.primaryPmName || "Select Primary PM"}
                          </option>
                        )}
                        {managers.map((m: ProjectManager) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Secondary PM Dropdown */}
                    <td className="p-3">
                      <select
                        value={row.resolvedSecondaryPmId || ""}
                        onChange={(e) => handleInlineChange(idx, "resolvedSecondaryPmId", e.target.value || null)}
                        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                      >
                        <option value="">None</option>
                        {managers.map((m: ProjectManager) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Timeline Dates */}
                    <td className="p-3">
                      <div className="text-xs text-foreground font-medium space-y-0.5 w-36">
                        <div>{row.startDate ? row.startDate.slice(0, 10) : "—"}</div>
                        <div className="text-muted-foreground/60">→ {row.endDate ? row.endDate.slice(0, 10) : "—"}</div>
                      </div>
                    </td>

                    {/* Budget */}
                    <td className="p-3">
                      {isCurrencyValid(row.currency) ? (
                        <div className="text-xs font-semibold text-foreground w-40">
                          {formatBudget(row.value, row.currency)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-40">
                          <EnumSelect
                            value={row.currency}
                            options={CURRENCY_OPTIONS}
                            onChange={(val) => handleInlineChange(idx, "currency", val)}
                            placeholder="Cur"
                            className="w-16"
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {(row.value || 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {isStatusValid(row.status) ? (
                        (() => {
                          const statusCfg = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
                          return (
                            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", statusCfg.bg, statusCfg.text, statusCfg.border)}>
                              <span className={cn("size-1.5 rounded-full", statusCfg.dot)} />
                              {statusCfg.label}
                            </span>
                          );
                        })()
                      ) : (
                        <EnumSelect
                          value={row.status}
                          options={STATUS_OPTIONS}
                          onChange={(val) => handleInlineChange(idx, "status", val)}
                          placeholder="Select Status"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
