"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Bug, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectsQuery } from "@/domains/projects/api/projects.api";
import {
  useDeleteIssueMutation,
  useGetIssuesQuery,
  useUpdateIssueMutation,
} from "../api/issues.api";
import { ISSUE_STATUS_OPTIONS } from "../schemas/issue.schema";
import type { Issue } from "../types/issues.types";
import { getApiErrorMessage, priorityBadgeClass } from "../utils/form-utils";
import { IssueForm } from "./issue-form";
import { ListPagination, paginateItems } from "./list-pagination";

export function IssueTrackerPage() {
  const { canViewIssues, canEditIssues } = useModulePermissions();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editing, setEditing] = useState<Issue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];

  const listParams = useMemo(
    () => ({
      ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    }),
    [projectFilter, statusFilter],
  );

  const { data: issues = [], isLoading, isError } = useGetIssuesQuery(listParams, {
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
    setUpdatingStatusId(issue.id);
    try {
      await updateIssue({
        projectId: issue.projectId,
        issueId: issue.id,
        body: { status },
      }).unwrap();
      toast.success("Status updated");
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
          canEditIssues ? (
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

      {formMode !== "closed" && canEditIssues && (
        <IssueForm
          mode={formMode}
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
                  <th className="text-start px-4 py-3 font-medium">Status</th>
                  {canEditIssues && (
                    <th className="text-end px-4 py-3 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedIssues.map((issue) => (
                  <tr key={issue.id} className="border-t border-border/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{issue.title}</div>
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
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.dueDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {canEditIssues ? (
                        <Select
                          value={issue.status}
                          onValueChange={(v) => {
                            if (v) void handleStatusChange(issue, v);
                          }}
                          disabled={updatingStatusId === issue.id}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue>{issue.status}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ISSUE_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        issue.status
                      )}
                    </td>
                    {canEditIssues && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1">
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
