"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Check,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import {
  BUDGET_LINE_CATEGORIES,
  useApproveBudgetRevisionMutation,
  useCreateBudgetBaselineMutation,
  useCreateBudgetLineItemMutation,
  useDeleteBudgetLineItemMutation,
  useGetProjectBudgetQuery,
  useGetProjectResourceCostsQuery,
  useProposeBudgetRevisionMutation,
  useRejectBudgetRevisionMutation,
  useProposeBudgetAdjustmentMutation,
  useApproveBudgetAdjustmentMutation,
  useRejectBudgetAdjustmentMutation,
} from "@/domains/budget";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";

type ProjectBudgetPanelProps = {
  projectId: string;
  canEdit: boolean;
};

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

function statusTone(status: string) {
  if (status === "Approved") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "Rejected") return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
}

export function ProjectBudgetPanel({ projectId, canEdit }: ProjectBudgetPanelProps) {
  const { canViewRates } = useModulePermissions();
  const { data, isLoading, isError, error } = useGetProjectBudgetQuery(projectId);
  const [resourceGroupBy, setResourceGroupBy] = useState<
    "detail" | "employee" | "month"
  >("detail");
  const { data: resourceCosts, isLoading: loadingResourceCosts } =
    useGetProjectResourceCostsQuery(
      { projectId, groupBy: resourceGroupBy },
      { skip: !projectId },
    );
  const [createBaseline, { isLoading: creatingBaseline }] =
    useCreateBudgetBaselineMutation();
  const [proposeRevision, { isLoading: proposing }] =
    useProposeBudgetRevisionMutation();
  const [approveRevision, { isLoading: approving }] =
    useApproveBudgetRevisionMutation();
  const [rejectRevision, { isLoading: rejecting }] =
    useRejectBudgetRevisionMutation();
  const [createLineItem, { isLoading: creatingLine }] =
    useCreateBudgetLineItemMutation();
  const [deleteLineItem, { isLoading: deletingLine }] =
    useDeleteBudgetLineItemMutation();
  const [proposeAdjustment, { isLoading: proposingAdj }] =
    useProposeBudgetAdjustmentMutation();
  const [approveAdjustment, { isLoading: approvingAdj }] =
    useApproveBudgetAdjustmentMutation();
  const [rejectAdjustment, { isLoading: rejectingAdj }] =
    useRejectBudgetAdjustmentMutation();

  const [baselineAmount, setBaselineAmount] = useState("");
  const [revisionAmount, setRevisionAmount] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [lineCategory, setLineCategory] = useState<string>("Other");
  const [lineName, setLineName] = useState("");
  const [linePlanned, setLinePlanned] = useState("");
  const [lineActual, setLineActual] = useState("0");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [showLineForm, setShowLineForm] = useState(false);
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjTarget, setAdjTarget] = useState<string>("Baseline");
  const [adjLineId, setAdjLineId] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const pendingRevision = useMemo(
    () => data?.revisions.find((r) => r.status === "Pending") ?? null,
    [data?.revisions],
  );

  const busy =
    creatingBaseline ||
    proposing ||
    approving ||
    rejecting ||
    creatingLine ||
    deletingLine ||
    proposingAdj ||
    approvingAdj ||
    rejectingAdj;

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center text-muted-foreground gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading budget…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {(error as { data?: { message?: string } })?.data?.message ??
          "Unable to load project budget."}
      </div>
    );
  }

  const currency = data.currency;
  const hasBaseline = Boolean(data.budgetId);

  const onCreateBaseline = async () => {
    const amount = Number(baselineAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid baseline amount greater than zero");
      return;
    }
    try {
      await createBaseline({
        projectId,
        body: { amount, currency },
      }).unwrap();
      toast.success("Budget baseline approved");
      setBaselineAmount("");
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Failed to create baseline";
      toast.error(message);
    }
  };

  const onProposeRevision = async () => {
    const revisedAmount = Number(revisionAmount.replace(/,/g, ""));
    if (!Number.isFinite(revisedAmount) || revisedAmount <= 0) {
      toast.error("Enter a valid revised amount");
      return;
    }
    if (!revisionReason.trim()) {
      toast.error("Revision reason is required");
      return;
    }
    try {
      await proposeRevision({
        projectId,
        body: { revisedAmount, reason: revisionReason.trim() },
      }).unwrap();
      toast.success("Revision submitted for approval");
      setRevisionAmount("");
      setRevisionReason("");
      setShowRevisionForm(false);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Failed to propose revision";
      toast.error(message);
    }
  };

  const onCreateLine = async () => {
    const planned = Number(linePlanned.replace(/,/g, ""));
    const actual = Number(lineActual.replace(/,/g, "") || "0");
    if (!lineName.trim()) {
      toast.error("Line item name is required");
      return;
    }
    if (!Number.isFinite(planned) || planned < 0) {
      toast.error("Enter a valid planned amount");
      return;
    }
    try {
      await createLineItem({
        projectId,
        body: {
          category: lineCategory,
          itemName: lineName.trim(),
          planned,
          actual: Number.isFinite(actual) ? actual : 0,
        },
      }).unwrap();
      toast.success("Cost line added");
      setLineName("");
      setLinePlanned("");
      setLineActual("0");
      setShowLineForm(false);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Failed to add line item";
      toast.error(message);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-auto p-4 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="size-4" /> Financials
          </h2>
          <p className="text-xs text-muted-foreground">
            Approved baseline, revisions, expected vs actual, and cost lines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Current budget", value: money(data.summary.currentBudgetAmount, currency) },
          { label: "Expected", value: money(data.summary.expectedCost, currency) },
          { label: "Actual", value: money(data.summary.actualCost, currency) },
          {
            label: "Variance",
            value: `${money(data.summary.variance, currency)}${
              data.summary.variancePct != null ? ` (${data.summary.variancePct}%)` : ""
            }`,
          },
          { label: "Revenue", value: money(data.summary.revenue, currency) },
          {
            label: "Margin",
            value: `${money(data.summary.margin, currency)}${
              data.summary.marginPct != null ? ` (${data.summary.marginPct}%)` : ""
            }`,
          },
          { label: "Baseline", value: money(data.baselineAmount, currency) },
          {
            label: "Basis",
            value:
              data.summary.currencyBasis === "budget"
                ? "Approved budget"
                : data.summary.currencyBasis === "project_value"
                  ? "Project value"
                  : "None",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] p-3 space-y-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="text-sm font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Resource cost breakdown</h3>
            <p className="text-xs text-muted-foreground">
              From approved timesheets
              {resourceCosts?.includeRates || canViewRates
                ? " (rates visible for finance)."
                : " (hourly rates hidden)."}
            </p>
          </div>
          <Select
            value={resourceGroupBy}
            onValueChange={(v) => {
              if (v === "employee" || v === "month" || v === "detail") {
                setResourceGroupBy(v);
              }
            }}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detail">By employee / month</SelectItem>
              <SelectItem value="employee">By employee</SelectItem>
              <SelectItem value="month">By month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingResourceCosts ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading resource costs…
          </p>
        ) : !resourceCosts?.rows.length ? (
          <p className="text-xs text-muted-foreground italic">
            No employee cost rows yet. Approve timesheets to populate.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-white/[0.08]">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {resourceGroupBy !== "month" ? (
                    <th className="text-left font-semibold px-3 py-2">Employee</th>
                  ) : null}
                  {resourceGroupBy !== "employee" ? (
                    <th className="text-left font-semibold px-3 py-2">Period</th>
                  ) : null}
                  <th className="text-right font-semibold px-3 py-2">Regular</th>
                  <th className="text-right font-semibold px-3 py-2">OT</th>
                  {(resourceCosts.includeRates || canViewRates) &&
                  resourceGroupBy !== "month" ? (
                    <th className="text-right font-semibold px-3 py-2">Rate</th>
                  ) : null}
                  <th className="text-right font-semibold px-3 py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {resourceCosts.rows.map((row, idx) => (
                  <tr
                    key={`${row.employeeId ?? "all"}-${row.periodYear ?? 0}-${row.periodMonth ?? 0}-${idx}`}
                    className="border-t border-slate-200/60 dark:border-white/[0.06]"
                  >
                    {resourceGroupBy !== "month" ? (
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {row.employeeName ?? "—"}
                        </div>
                        {row.designation ? (
                          <div className="text-[10px] text-muted-foreground">
                            {row.designation}
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {resourceGroupBy !== "employee" ? (
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.periodYear != null && row.periodMonth != null
                          ? `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`
                          : "—"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.regularHours}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.overtimeHours}
                    </td>
                    {(resourceCosts.includeRates || canViewRates) &&
                    resourceGroupBy !== "month" ? (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.ratePerHour != null
                          ? money(row.ratePerHour, currency)
                          : "—"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(row.totalCost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!hasBaseline ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Approve baseline</h3>
            <p className="text-xs text-muted-foreground">
              Create the first approved project budget. Project value today:{" "}
              {money(data.projectValue, currency)}.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="baseline-amount">Amount ({currency})</Label>
                <Input
                  id="baseline-amount"
                  value={baselineAmount}
                  onChange={(e) => setBaselineAmount(e.target.value)}
                  placeholder="250000"
                  className="w-40"
                  disabled={busy}
                />
              </div>
              <Button onClick={onCreateBaseline} disabled={busy}>
                {creatingBaseline ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Approve baseline"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You can view financials but need edit permission to set a baseline.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Revisions</h3>
              <p className="text-xs text-muted-foreground">
                Approved by {data.approver?.displayName ?? "—"}
                {data.approvedAt
                  ? ` on ${new Date(data.approvedAt).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            {canEdit && !pendingRevision && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRevisionForm((v) => !v)}
              >
                <Plus className="size-3.5" /> Propose revision
              </Button>
            )}
          </div>

          {showRevisionForm && canEdit && (
            <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="rev-amount">Revised amount ({currency})</Label>
                  <Input
                    id="rev-amount"
                    value={revisionAmount}
                    onChange={(e) => setRevisionAmount(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="rev-reason">Reason</Label>
                  <textarea
                    id="rev-reason"
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    rows={2}
                    disabled={busy}
                    className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onProposeRevision} disabled={busy}>
                  {proposing ? <Loader2 className="size-4 animate-spin" /> : "Submit"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRevisionForm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {data.revisions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No revisions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-white/[0.08]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Amount</th>
                    <th className="text-left font-semibold px-3 py-2">Reason</th>
                    <th className="text-left font-semibold px-3 py-2">Status</th>
                    <th className="text-left font-semibold px-3 py-2">Date</th>
                    <th className="text-right font-semibold px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revisions.map((rev) => (
                    <tr
                      key={rev.id}
                      className="border-t border-slate-200/60 dark:border-white/[0.06]"
                    >
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {money(rev.revisedAmount, currency)}
                      </td>
                      <td className="px-3 py-2 max-w-[240px] truncate" title={rev.reason}>
                        {rev.reason}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={cn("font-medium", statusTone(rev.status))}
                        >
                          {rev.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit && rev.status === "Pending" ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={busy}
                              onClick={async () => {
                                try {
                                  await approveRevision({
                                    projectId,
                                    revisionId: rev.id,
                                  }).unwrap();
                                  toast.success("Revision approved");
                                } catch (err) {
                                  toast.error(
                                    (err as { data?: { message?: string } })?.data
                                      ?.message ?? "Approve failed",
                                  );
                                }
                              }}
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={busy}
                              onClick={async () => {
                                try {
                                  await rejectRevision({
                                    projectId,
                                    revisionId: rev.id,
                                  }).unwrap();
                                  toast.success("Revision rejected");
                                } catch (err) {
                                  toast.error(
                                    (err as { data?: { message?: string } })?.data
                                      ?.message ?? "Reject failed",
                                  );
                                }
                              }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasBaseline && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Cost line items</h3>
              <p className="text-xs text-muted-foreground">
                Resource and other costs (planned vs actual).
              </p>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLineForm((v) => !v)}
              >
                <Plus className="size-3.5" /> Add line
              </Button>
            )}
          </div>

          {showLineForm && canEdit && (
            <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] p-3 grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={lineCategory}
                  onValueChange={(v) => {
                    if (v) setLineCategory(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_LINE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label>Planned</Label>
                <Input
                  value={linePlanned}
                  onChange={(e) => setLinePlanned(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label>Actual</Label>
                <Input
                  value={lineActual}
                  onChange={(e) => setLineActual(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="sm:col-span-4 flex gap-2">
                <Button size="sm" onClick={onCreateLine} disabled={busy}>
                  {creatingLine ? <Loader2 className="size-4 animate-spin" /> : "Save line"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowLineForm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {data.lineItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No cost lines yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-white/[0.08]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Category</th>
                    <th className="text-left font-semibold px-3 py-2">Item</th>
                    <th className="text-right font-semibold px-3 py-2">Planned</th>
                    <th className="text-right font-semibold px-3 py-2">Actual</th>
                    <th className="text-right font-semibold px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.lineItems.map((line) => (
                    <tr
                      key={line.id}
                      className="border-t border-slate-200/60 dark:border-white/[0.06]"
                    >
                      <td className="px-3 py-2">{line.category}</td>
                      <td className="px-3 py-2 font-medium">{line.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(line.planned, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(line.actual, currency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-600"
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await deleteLineItem({
                                  projectId,
                                  lineItemId: line.id,
                                }).unwrap();
                                toast.success("Line removed");
                              } catch (err) {
                                toast.error(
                                  (err as { data?: { message?: string } })?.data
                                    ?.message ?? "Delete failed",
                                );
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasBaseline && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Manual adjustments</h3>
              <p className="text-xs text-muted-foreground">
                Request approved changes to baseline or line planned/actual with audit trail.
              </p>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAdjForm((v) => !v)}
              >
                <Plus className="size-3.5" /> Request adjustment
              </Button>
            )}
          </div>

          {showAdjForm && canEdit && (
            <div className="rounded-lg border border-slate-200/70 dark:border-white/8 p-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Target</Label>
                <Select
                  value={adjTarget}
                  onValueChange={(v) => {
                    if (!v) return;
                    setAdjTarget(v);
                    if (v === "Baseline") setAdjLineId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baseline">Baseline</SelectItem>
                    <SelectItem value="LinePlanned">Line planned</SelectItem>
                    <SelectItem value="LineActual">Line actual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {adjTarget !== "Baseline" && (
                <div className="space-y-1">
                  <Label>Line item</Label>
                  <Select
                    value={adjLineId}
                    onValueChange={(v) => {
                      if (v) setAdjLineId(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select line" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.lineItems.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.category}: {line.itemName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>New amount ({currency})</Label>
                <Input
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Reason</Label>
                <textarea
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  rows={2}
                  disabled={busy}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const newAmount = Number(adjAmount.replace(/,/g, ""));
                    if (!Number.isFinite(newAmount) || newAmount < 0) {
                      toast.error("Enter a valid amount");
                      return;
                    }
                    if (!adjReason.trim()) {
                      toast.error("Reason is required");
                      return;
                    }
                    if (adjTarget !== "Baseline" && !adjLineId) {
                      toast.error("Select a line item");
                      return;
                    }
                    try {
                      await proposeAdjustment({
                        projectId,
                        body: {
                          targetField: adjTarget,
                          lineItemId:
                            adjTarget === "Baseline" ? undefined : adjLineId,
                          newAmount,
                          reason: adjReason.trim(),
                        },
                      }).unwrap();
                      toast.success("Adjustment submitted");
                      setAdjAmount("");
                      setAdjReason("");
                      setShowAdjForm(false);
                    } catch (err) {
                      toast.error(
                        (err as { data?: { message?: string } })?.data
                          ?.message ?? "Failed to submit adjustment",
                      );
                    }
                  }}
                >
                  {proposingAdj ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAdjForm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(data.adjustments?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground italic">No adjustments yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-white/8">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Target</th>
                    <th className="text-right font-semibold px-3 py-2">Old</th>
                    <th className="text-right font-semibold px-3 py-2">New</th>
                    <th className="text-left font-semibold px-3 py-2">Reason</th>
                    <th className="text-left font-semibold px-3 py-2">Status</th>
                    <th className="text-right font-semibold px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.adjustments ?? []).map((adj) => (
                    <tr
                      key={adj.id}
                      className="border-t border-slate-200/60 dark:border-white/6"
                    >
                      <td className="px-3 py-2">{adj.targetField}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(adj.oldAmount, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(adj.newAmount, currency)}
                      </td>
                      <td className="px-3 py-2 max-w-60 truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={cn("font-medium", statusTone(adj.status))}
                        >
                          {adj.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit && adj.status === "Pending" ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={busy}
                              onClick={async () => {
                                try {
                                  await approveAdjustment({
                                    projectId,
                                    adjustmentId: adj.id,
                                  }).unwrap();
                                  toast.success("Adjustment approved");
                                } catch (err) {
                                  toast.error(
                                    (err as { data?: { message?: string } })?.data
                                      ?.message ?? "Approve failed",
                                  );
                                }
                              }}
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={busy}
                              onClick={async () => {
                                try {
                                  await rejectAdjustment({
                                    projectId,
                                    adjustmentId: adj.id,
                                  }).unwrap();
                                  toast.success("Adjustment rejected");
                                } catch (err) {
                                  toast.error(
                                    (err as { data?: { message?: string } })?.data
                                      ?.message ?? "Reject failed",
                                  );
                                }
                              }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
