"use client";

import type { ReactNode } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import { cn } from "@/shared/utils/cn";
import { ISSUE_STATUS_OPTIONS } from "../schemas/issue.schema";
import type { Issue, IssueEvidenceFile } from "../types/issues.types";
import {
  issueStatusBadgeClass,
  priorityBadgeClass,
} from "../utils/form-utils";
import { FormSheet } from "./form-sheet";

function evidenceFilesFor(issue: Issue): IssueEvidenceFile[] {
  if (issue.evidenceFiles && issue.evidenceFiles.length > 0) {
    return issue.evidenceFiles;
  }
  if (issue.s3EvidenceKey) {
    return [{ storageKey: issue.s3EvidenceKey, filename: "Evidence file" }];
  }
  return [];
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

type IssueDetailsSheetProps = {
  open: boolean;
  issue: Issue | null;
  canManage?: boolean;
  canUpdateStatus?: boolean;
  updatingStatus?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onStatusChange?: (status: string) => void;
  onResolveClose?: (status: "Resolved" | "Closed") => void;
};

export function IssueDetailsSheet({
  open,
  issue,
  canManage = false,
  canUpdateStatus = false,
  updatingStatus = false,
  onClose,
  onEdit,
  onStatusChange,
  onResolveClose,
}: IssueDetailsSheetProps) {
  const files = issue ? evidenceFilesFor(issue) : [];
  const canActOnStatus =
    canManage &&
    issue &&
    issue.status !== "Closed" &&
    issue.status !== "Cancelled";

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={issue?.title ?? "Issue details"}
      description={
        issue
          ? `${issue.projectName ?? "Project"} · ${issue.status}`
          : "View issue details"
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {!issue ? (
            <p className="text-sm text-muted-foreground">No issue selected.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("border", priorityBadgeClass(issue.priority))}
                >
                  {issue.priority}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("border", issueStatusBadgeClass(issue.status))}
                >
                  {issue.status}
                </Badge>
                {issue.isOverdue && (
                  <Badge
                    variant="outline"
                    className="border text-rose-700 border-rose-200 bg-rose-50"
                  >
                    Overdue
                  </Badge>
                )}
                {issue.requiresEscalation && (
                  <Badge
                    variant="outline"
                    className="border text-amber-800 border-amber-200 bg-amber-50"
                  >
                    Escalation
                  </Badge>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Project">
                  {issue.projectName ?? "—"}
                </DetailRow>
                <DetailRow label="Owner">
                  {issue.owner?.displayName ?? "—"}
                </DetailRow>
                <DetailRow label="Raised by">
                  {issue.raiser?.displayName ?? "—"}
                </DetailRow>
                <DetailRow label="Due date">{issue.dueDate ?? "—"}</DetailRow>
                <DetailRow label="Expected resolution">
                  {issue.expectedResolutionDate ?? "—"}
                </DetailRow>
                <DetailRow label="Updated">
                  {new Date(issue.updatedAt).toLocaleString()}
                </DetailRow>
              </div>

              {canUpdateStatus && onStatusChange ? (
                <DetailRow label="Update status">
                  <Select
                    value={issue.status}
                    onValueChange={(v) => {
                      if (!v || v === issue.status) return;
                      onStatusChange(v);
                    }}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="w-full max-w-xs">
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
                </DetailRow>
              ) : null}

              <DetailRow label="Resolution note">
                {issue.resolutionNote?.trim() || (
                  <span className="text-muted-foreground">None yet</span>
                )}
              </DetailRow>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Evidence</p>
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No evidence attached
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {files.map((file) => (
                      <SecureFileLink
                        key={file.storageKey}
                        storageKey={file.storageKey}
                        filename={file.filename}
                        showLabel
                        label={file.filename}
                        className="justify-start text-sm"
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canManage && onEdit && issue && (
            <Button type="button" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canActOnStatus && onResolveClose && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onResolveClose("Resolved")}
              >
                Resolve…
              </Button>
              <Button type="button" onClick={() => onResolveClose("Closed")}>
                Close with evidence…
              </Button>
            </>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
