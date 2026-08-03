"use client";

import { useMemo, useState } from "react";
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
  useCloseIssueMutation,
  useDeleteIssueMutation,
  useGetIssuesQuery,
} from "../api/issues.api";
import { ISSUE_STATUS_OPTIONS } from "../schemas/issue.schema";
import type { Issue } from "../types/issues.types";
import { getApiErrorMessage } from "../utils/form-utils";
import { IssueForm } from "./issue-form";

function priorityClass(priority: string) {
  if (priority === "Critical" || priority === "High") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (priority === "Medium") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function IssueTrackerPage() {
  const { canViewIssues, canEditIssues } = useModulePermissions();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editing, setEditing] = useState<Issue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);

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
  const [closeIssue] = useCloseIssueMutation();
  const [deleteIssue, { isLoading: isDeleting }] = useDeleteIssueMutation();

  const selectedFilterProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name;

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
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t border-border/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{issue.title}</div>
                    {issue.isOverdue && (
                      <div className="text-xs text-rose-600">Overdue</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.projectName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("border", priorityClass(issue.priority))}
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
                  <td className="px-4 py-3">{issue.status}</td>
                  {canEditIssues && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
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
                        {issue.status !== "Closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await closeIssue({
                                  projectId: issue.projectId,
                                  issueId: issue.id,
                                }).unwrap();
                                toast.success("Issue closed");
                              } catch (err) {
                                toast.error(
                                  getApiErrorMessage(err, "Failed to close issue"),
                                );
                              }
                            }}
                          >
                            Close
                          </Button>
                        )}
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
