"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useAuth } from "@/domains/auth/hooks/use-auth";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectsQuery } from "@/domains/projects/api/projects.api";
import {
  useDeleteRiskMutation,
  useGetRisksQuery,
  useUpdateRiskMutation,
} from "../api/risks.api";
import {
  RISK_CATEGORY_OPTIONS,
  RISK_STATUS_OPTIONS,
} from "../schemas/risk.schema";
import type { Risk } from "../types/risks.types";
import { getApiErrorMessage, scoreBadgeClass } from "../utils/form-utils";
import { ListPagination, paginateItems } from "./list-pagination";
import { RiskForm } from "./risk-form";

export function RiskRegisterPage() {
  const { user } = useAuth();
  const { canViewRisks, canEditRisks } = useModulePermissions();
  const isEngineer = (user?.backendRoleCode ?? "") === "engineer";
  const canManageRisks = canEditRisks && !isEngineer;
  const canUpdateRiskStatus = canManageRisks || isEngineer;

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editing, setEditing] = useState<Risk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Risk | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];
  const listParams = useMemo(
    () => ({
      ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
    }),
    [projectFilter, statusFilter, categoryFilter],
  );

  const { data: risks = [], isLoading, isError } = useGetRisksQuery(listParams, {
    skip: !canViewRisks,
  });
  const [updateRisk] = useUpdateRiskMutation();
  const [deleteRisk, { isLoading: isDeleting }] = useDeleteRiskMutation();

  useEffect(() => {
    setPage(1);
  }, [projectFilter, statusFilter, categoryFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(risks.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedRisks = useMemo(
    () => paginateItems(risks, page, pageSize),
    [risks, page, pageSize],
  );

  const selectedFilterProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name;

  async function handleStatusChange(risk: Risk, status: string) {
    if (status === risk.status) return;
    setUpdatingStatusId(risk.id);
    try {
      await updateRisk({
        projectId: risk.projectId,
        riskId: risk.id,
        body: { status },
      }).unwrap();
      toast.success("Status updated");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  if (!canViewRisks) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view the risk register.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Risk Register"
        description="Track project risks with impact × likelihood scoring, ownership, and mitigation plans."
        actions={
          canManageRisks ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormMode("create");
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Add risk
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select
          value={projectFilter}
          onValueChange={(v) => setProjectFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Project">
              {selectedFilterProjectName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category">
              {categoryFilter === "all" ? "All categories" : categoryFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {RISK_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status">
              {statusFilter === "all" ? "All statuses" : statusFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RISK_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canManageRisks && (
        <RiskForm
          open={formMode !== "closed"}
          mode={formMode === "edit" ? "edit" : "create"}
          risk={editing}
          projects={projects}
          defaultProjectId={
            projectFilter !== "all" ? projectFilter : projects[0]?.id
          }
          onCancel={() => {
            setFormMode("closed");
            setEditing(null);
          }}
          onSuccess={() => {
            setFormMode("closed");
            setEditing(null);
          }}
        />
      )}

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading risks…
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-destructive">
            Failed to load risks.
          </div>
        ) : risks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <AlertTriangle className="size-8 opacity-40" />
            <p>No risks found.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">Risk</th>
                  <th className="text-start px-4 py-3 font-medium">Project</th>
                  <th className="text-start px-4 py-3 font-medium">Score</th>
                  <th className="text-start px-4 py-3 font-medium">Owner</th>
                  <th className="text-start px-4 py-3 font-medium">Mitigation plan</th>
                  <th className="text-start px-4 py-3 font-medium">Status</th>
                  <th className="text-start px-4 py-3 font-medium">Target</th>
                  {canManageRisks && (
                    <th className="text-end px-4 py-3 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedRisks.map((risk) => (
                  <tr key={risk.id} className="border-t border-border/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{risk.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {risk.category}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {risk.projectName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("border", scoreBadgeClass(risk.score))}
                      >
                        {risk.score} ({risk.impact}×{risk.likelihood})
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {risk.owner?.displayName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[220px]">
                      <span className="line-clamp-2" title={risk.mitigationPlan ?? undefined}>
                        {risk.mitigationPlan?.trim() || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canUpdateRiskStatus ? (
                        <Select
                          value={risk.status}
                          onValueChange={(v) => {
                            if (v) void handleStatusChange(risk, v);
                          }}
                          disabled={updatingStatusId === risk.id}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue>{risk.status}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {RISK_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        risk.status
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {risk.targetDate ?? "—"}
                    </td>
                    {canManageRisks && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(risk);
                              setFormMode("edit");
                            }}
                            aria-label="Edit risk"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(risk)}
                            aria-label="Delete risk"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={risks.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      <DeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete risk?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? This cannot be undone.`
            : ""
        }
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteRisk({
              projectId: deleteTarget.projectId,
              riskId: deleteTarget.id,
            }).unwrap();
            toast.success("Risk deleted");
            setDeleteTarget(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "Failed to delete risk"));
          }
        }}
      />
    </div>
  );
}
