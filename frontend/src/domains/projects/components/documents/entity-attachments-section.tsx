"use client";

import React, { useRef, useState } from "react";
import {
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import { FilePreviewModal } from "../tasks/file-preview-modal";
import type { WorkspaceDocument } from "../../types/project-documents.types";
import { cn } from "@/shared/utils/cn";
import { toast } from "react-hot-toast";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LIMITS_HINT,
  attachmentValidationToastMessage,
  validateAttachmentFiles,
} from "../../utils/attachment-limits";

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ filename, className }: { filename: string; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return <ImageIcon className={cn("text-sky-600", className)} />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className={cn("text-emerald-600", className)} />;
  }
  return <FileText className={cn("text-muted-foreground", className)} />;
}

interface EntityAttachmentsSectionProps {
  title?: string;
  documents: WorkspaceDocument[];
  draftFiles: File[];
  onDraftFilesChange: (files: File[]) => void;
  /** When set, files upload immediately instead of staying as drafts. */
  onImmediateUpload?: (files: File[]) => Promise<void>;
  onDeleteDocument?: (documentId: string) => void;
  isLoading?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  canEdit?: boolean;
  emptyHint?: string;
}

export function EntityAttachmentsSection({
  title = "Attachments",
  documents,
  draftFiles,
  onDraftFilesChange,
  onImmediateUpload,
  onDeleteDocument,
  isLoading = false,
  isUploading = false,
  isDeleting = false,
  canEdit = true,
  emptyHint = "No attachments yet.",
}: EntityAttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewTarget, setPreviewTarget] = useState<{
    filename: string;
    url?: string | null;
    storageKey?: string | null;
    file?: File;
  } | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const existingCount = onImmediateUpload
      ? documents.length
      : draftFiles.length;
    const { valid, issues } = validateAttachmentFiles(selected, { existingCount });
    if (issues.length) {
      toast.error(attachmentValidationToastMessage(issues));
    }
    if (!valid.length) return;

    if (onImmediateUpload) {
      await onImmediateUpload(valid);
      return;
    }
    onDraftFilesChange([...draftFiles, ...valid]);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
            {(documents.length > 0 || draftFiles.length > 0) && (
              <span className="ml-1.5 text-[10px] font-medium normal-case text-foreground">
                ({documents.length + draftFiles.length})
              </span>
            )}
          </h4>
        </div>
        {canEdit && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {onImmediateUpload ? "Upload" : "Add files"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={ATTACHMENT_ACCEPT}
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>
      {canEdit && (
        <p className="text-[10px] text-muted-foreground">{ATTACHMENT_LIMITS_HINT}</p>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading attachments...
        </div>
      )}

      {!isLoading && documents.length === 0 && draftFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}

      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <FileTypeIcon filename={doc.filename} className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() =>
                  setPreviewTarget({
                    filename: doc.filename,
                    url: doc.url,
                    storageKey: doc.s3Key,
                  })
                }
                className="w-full truncate text-left text-sm font-medium outline-none transition-colors hover:text-primary"
              >
                {doc.filename}
              </button>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {doc.uploader?.displayName ?? "Uploaded"}
                {doc.sizeBytes ? ` · ${formatFileSize(doc.sizeBytes)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setPreviewTarget({
                  filename: doc.filename,
                  url: doc.url,
                  storageKey: doc.s3Key,
                })
              }
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              title="Preview file"
            >
              <Eye className="size-4" />
            </button>
            <SecureFileLink
              storageKey={doc.s3Key}
              filename={doc.filename}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
              iconClassName="size-4"
            />
            {canEdit && onDeleteDocument && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isDeleting}
                onClick={() => onDeleteDocument(doc.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}

        {draftFiles.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2"
          >
            <FileTypeIcon filename={file.name} className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPreviewTarget({ filename: file.name, file })}
                className="w-full truncate text-left text-sm font-medium outline-none transition-colors hover:text-primary"
              >
                {file.name}
              </button>
              <p className="mt-0.5 text-[10px] text-primary">
                Draft — saves with form · {formatFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewTarget({ filename: file.name, file })}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              title="Preview file"
            >
              <Eye className="size-4" />
            </button>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  onDraftFilesChange(draftFiles.filter((_, fileIndex) => fileIndex !== index))
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {previewTarget && (
        <FilePreviewModal
          open={!!previewTarget}
          onClose={() => setPreviewTarget(null)}
          filename={previewTarget.filename}
          url={previewTarget.url}
          storageKey={previewTarget.storageKey}
          file={previewTarget.file}
        />
      )}
    </section>
  );
}
