"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Bug, CheckCircle2, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  useDeleteIssueMutation,
  useGetIssuesQuery,
  useUpdateIssueMutation,
} from "../api/issues.api";
import { ISSUE_STATUS_OPTIONS } from "../schemas/issue.schema";
import type { Issue } from "../types/issues.types";
import {
  getApiErrorMessage,
  issueStatusBadgeClass,
  priorityBadgeClass,
} from "../utils/form-utils";
import { CloseIssueForm, type IssueResolveStatus } from "./close-issue-form";
import { IssueDetailsSheet } from "./issue-details-sheet";
import { IssueForm } from "./issue-form";
import { ListPagination, paginateItems } from "./list-pagination";

const TERMINAL_STATUSES = new Set(["Closed", "Cancelled"]);

export function IssueTrackerPage() {
  const { user } = useAuth();
  const { canViewIssues, canEditIssues } = useModulePermissions();
  const isEngineer = (user?.backendRoleCode ?? "") === "engineer";
  const canManageIssues = canEditIssues && !isEngineer;
  const canUpdateIssueStatus = canEditIssues;

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">(
    "closed",
  );
  const [editing, setEditing] = useState<Issue | null>(null);
  const [closeTarget, setCloseTarget] = useState<{
    issue: Issue;
    status: IssueResolveStatus;
  } | null>(null);
  const [viewTarget, setViewTarget] = useState<Issue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const { data: projectsResponse } = useGetProjectsQuery({
    page: 1,
    limit: 200,
  });
  const projects = projectsResponse?.data ?? [];

  const listParams = useMemo(
    () => ({
      ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    }),
    [projectFilter, statusFilter],
  );

  const {
    data: issues = [],
    isLoading,
    isError,
  } = useGetIssuesQuery(listParams, {
    skip: !canViewIssues,
  });
  const [updateIssue] = useUpdateIssueMutation();
  const [deleteIssue, { isLoading: isDeleting }] = useDeleteIssueMutation();

  useEffect(() => {
    setPage(1);
  }, [projectFilter, statusFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(issues.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedIssues = useMemo(
    () => paginateItems(issues, page, pageSize),
    [issues, page, pageSize],
  );

  const selectedFilterProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name;

  async function handleStatusChange(issue: Issue, status: string) {
    if (status === issue.status) return;

    if (
      canManageIssues &&
      (status === "Closed" || status === "Resolved")
    ) {
      setCloseTarget({ issue, status });
      return;
    }

    setUpdatingStatusId(issue.id);
    try {
      const updated = await updateIssue({
        projectId: issue.projectId,
        issueId: issue.id,
        body: { status },
      }).unwrap();
      toast.success("Status updated");
      setViewTarget((current) =>
        current?.id === updated.id ? updated : current,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  if (!canViewIssues) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view the issue tracker.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Issue Tracker"
        description="Track issues with priority, owners, expected resolution dates, escalation, and closure evidence."
        actions={
          canManageIssues ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormMode("create");
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Raise issue
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
            {ISSUE_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canManageIssues && (
        <IssueForm
          open={formMode !== "closed"}
          mode={formMode === "edit" ? "edit" : "create"}
          issue={editing}
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

      {canManageIssues && (
        <CloseIssueForm
          open={Boolean(closeTarget)}
          issue={closeTarget?.issue ?? null}
          targetStatus={closeTarget?.status ?? "Closed"}
          onCancel={() => setCloseTarget(null)}
          onSuccess={() => setCloseTarget(null)}
        />
      )}

      <IssueDetailsSheet
        open={Boolean(viewTarget)}
        issue={viewTarget}
        canManage={canManageIssues}
        canUpdateStatus={canUpdateIssueStatus}
        updatingStatus={Boolean(
          viewTarget && updatingStatusId === viewTarget.id,
        )}
        onClose={() => setViewTarget(null)}
        onStatusChange={
          canUpdateIssueStatus && viewTarget
            ? (status) => void handleStatusChange(viewTarget, status)
            : undefined
        }
        onEdit={
          canManageIssues && viewTarget
            ? () => {
                setEditing(viewTarget);
                setFormMode("edit");
                setViewTarget(null);
              }
            : undefined
        }
        onResolveClose={
          canManageIssues
            ? (status) => {
                if (!viewTarget) return;
                setCloseTarget({ issue: viewTarget, status });
                setViewTarget(null);
              }
            : undefined
        }
      />

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading issues…
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-destructive">
            Failed to load issues.
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bug className="size-8 opacity-40" />
            <p>No issues found.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">Issue</th>
                  <th className="text-start px-4 py-3 font-medium">Project</th>
                  <th className="text-start px-4 py-3 font-medium">Priority</th>
                  <th className="text-start px-4 py-3 font-medium">Owner</th>
                  <th className="text-start px-4 py-3 font-medium">Due</th>
                  <th className="text-start px-4 py-3 font-medium">
                    Expected resolution
                  </th>
                  <th className="text-start px-4 py-3 font-medium">Status</th>
                  <th className="text-end px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedIssues.map((issue) => {
                  const canClose =
                    canManageIssues && !TERMINAL_STATUSES.has(issue.status);
                  return (
                    <tr key={issue.id} className="border-t border-border/40">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-start font-medium hover:underline"
                          onClick={() => setViewTarget(issue)}
                        >
                          {issue.title}
                        </button>
                        {issue.isOverdue && (
                          <Badge
                            variant="outline"
                            className="mt-1 border text-[10px] text-rose-700 border-rose-200 bg-rose-50"
                          >
                            Overdue
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {issue.projectName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border",
                            priorityBadgeClass(issue.priority),
                          )}
                        >
                          {issue.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {issue.owner?.displayName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {issue.dueDate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {issue.expectedResolutionDate ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border",
                            issueStatusBadgeClass(issue.status),
                          )}
                        >
                          {issue.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewTarget(issue)}
                            aria-label="View issue"
                            title="View details"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canClose && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setCloseTarget({
                                  issue,
                                  status: "Closed",
                                })
                              }
                              aria-label="Close issue"
                              title="Close with resolution / evidence"
                            >
                              <CheckCircle2 className="size-4 text-emerald-600" />
                            </Button>
                          )}
                          {canManageIssues && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditing(issue);
                                  setFormMode("edit");
                                }}
                                aria-label="Edit issue"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteTarget(issue)}
                                aria-label="Delete issue"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={issues.length}
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
        title="Delete issue?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? This cannot be undone.`
            : ""
        }
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteIssue({
              projectId: deleteTarget.projectId,
              issueId: deleteTarget.id,
            }).unwrap();
            toast.success("Issue deleted");
            setDeleteTarget(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "Failed to delete issue"));
          }
        }}
      />
    </div>
  );
}
