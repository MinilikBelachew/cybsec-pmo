"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { useUploadFileMutation } from "@/domains/projects/api/files.api";
import { formatFileUploadError } from "@/domains/projects/utils/attachment-limits";
import {
  useCloseIssueMutation,
  useUpdateIssueMutation,
} from "../api/issues.api";
import {
  closeIssueSchema,
  type CloseIssueFormValues,
} from "../schemas/issue.schema";
import type { Issue, IssueEvidenceFile } from "../types/issues.types";
import { getApiErrorMessage } from "../utils/form-utils";
import { FormSheet } from "./form-sheet";

export type IssueResolveStatus = "Resolved" | "Closed";

function issueEvidenceFiles(issue: Issue | null): IssueEvidenceFile[] {
  if (!issue) return [];
  if (issue.evidenceFiles && issue.evidenceFiles.length > 0) {
    return issue.evidenceFiles;
  }
  if (issue.s3EvidenceKey) {
    return [{ storageKey: issue.s3EvidenceKey, filename: "Evidence file" }];
  }
  return [];
}

type CloseIssueFormProps = {
  open: boolean;
  issue: Issue | null;
  targetStatus: IssueResolveStatus;
  onCancel: () => void;
  onSuccess: () => void;
};

export function CloseIssueForm({
  open,
  issue,
  targetStatus,
  onCancel,
  onSuccess,
}: CloseIssueFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<IssueEvidenceFile[]>([]);
  const [closeIssue, { isLoading: isClosing }] = useCloseIssueMutation();
  const [updateIssue, { isLoading: isUpdating }] = useUpdateIssueMutation();
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CloseIssueFormValues>({
    resolver: zodResolver(closeIssueSchema),
    defaultValues: { resolutionNote: "" },
  });

  const isClosingStatus = targetStatus === "Closed";
  const title = isClosingStatus ? "Close issue" : "Resolve issue";
  const submitLabel = isClosingStatus ? "Close issue" : "Mark resolved";

  useEffect(() => {
    if (!open) return;
    reset({
      resolutionNote: issue?.resolutionNote?.trim() || "",
    });
    setEvidenceFiles(issueEvidenceFiles(issue));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, issue, reset]);

  async function handleEvidenceSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const result = await uploadFile(file).unwrap();
          return {
            storageKey: result.storageKey,
            filename: result.filename,
          };
        }),
      );
      setEvidenceFiles((prev) => {
        const byKey = new Map(prev.map((f) => [f.storageKey, f]));
        for (const file of uploaded) {
          byKey.set(file.storageKey, file);
        }
        return Array.from(byKey.values());
      });
      toast.success(
        uploaded.length === 1
          ? "Evidence file attached"
          : `${uploaded.length} evidence files attached`,
      );
    } catch (err) {
      toast.error(formatFileUploadError(err, "Failed to upload evidence"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeEvidenceFile(storageKey: string) {
    setEvidenceFiles((prev) => prev.filter((f) => f.storageKey !== storageKey));
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!issue) return;
    const body = {
      resolutionNote: values.resolutionNote.trim(),
      evidenceFiles,
      s3EvidenceKey: evidenceFiles[0]?.storageKey,
    };
    try {
      if (isClosingStatus) {
        await closeIssue({
          projectId: issue.projectId,
          issueId: issue.id,
          body,
        }).unwrap();
        toast.success("Issue closed");
      } else {
        await updateIssue({
          projectId: issue.projectId,
          issueId: issue.id,
          body: { status: "Resolved", ...body },
        }).unwrap();
        toast.success("Issue resolved");
      }
      onSuccess();
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          isClosingStatus ? "Failed to close issue" : "Failed to resolve issue",
        ),
      );
    }
  });

  const isBusy = isClosing || isUpdating || isUploading;

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      description={
        issue
          ? `Record how “${issue.title}” was resolved and attach optional evidence.`
          : "Record resolution and optional evidence."
      }
    >
      <form
        onSubmit={onSubmit}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Resolution note{" "}
              <span className="text-destructive font-bold">*</span>
            </label>
            <Input
              {...register("resolutionNote")}
              placeholder="How was this resolved?"
              className={cn(errors.resolutionNote && "border-rose-500")}
            />
            {errors.resolutionNote && (
              <p className="text-xs text-destructive">
                {errors.resolutionNote.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Evidence (optional, multiple files)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleEvidenceSelected(e)}
            />
            {evidenceFiles.length > 0 && (
              <div className="space-y-2">
                {evidenceFiles.map((file) => (
                  <div
                    key={file.storageKey}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                  >
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {file.filename}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => removeEvidenceFile(file.storageKey)}
                      aria-label={`Remove ${file.filename}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              {evidenceFiles.length > 0 ? "Add more evidence" : "Attach evidence"}
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isBusy || !issue}>
            {(isClosing || isUpdating) && (
              <Loader2 className="size-4 me-2 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormSheet>
  );
}
