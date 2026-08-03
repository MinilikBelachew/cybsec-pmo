"use client";

import Link from "next/link";
import { CircleAlert, Loader2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectIssuesQuery } from "../api/issues.api";

type ProjectIssuesPanelProps = {
  projectId: string;
};

export function ProjectIssuesPanel({ projectId }: ProjectIssuesPanelProps) {
  const { canViewIssues, canEditIssues } = useModulePermissions();
  const { data: issues = [], isLoading } = useGetProjectIssuesQuery(projectId, {
    skip: !canViewIssues,
  });

  if (!canViewIssues) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        You do not have permission to view issues for this project.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Project issues</h2>
          <p className="text-xs text-muted-foreground">
            Tracked issues linked to this workspace.
          </p>
        </div>
        {canEditIssues && (
          <Link
            href="/dashboard/issues"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open tracker
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center text-muted-foreground gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : issues.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <CircleAlert className="size-8 opacity-40" />
          <p className="text-sm">No issues logged for this project.</p>
          {canEditIssues && (
            <Link
              href="/dashboard/issues"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Add in issue tracker
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-start px-4 py-3">Title</th>
                <th className="text-start px-4 py-3">Priority</th>
                <th className="text-start px-4 py-3">Status</th>
                <th className="text-start px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{issue.title}</td>
                  <td className="px-4 py-3">{issue.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{issue.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.owner?.displayName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
