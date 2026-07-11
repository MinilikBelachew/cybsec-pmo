"use client";

import React, { useMemo, useRef, useState } from "react";
import { Eye, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import { FilePreviewModal } from "../tasks/file-preview-modal";
import { useUploadFileMutation } from "../../api/files.api";
import { useGetMilestonesQuery, useGetPhasesQuery } from "../../api/projects.api";
import {
  useCreateProjectDocumentMutation,
  useDeleteProjectDocumentMutation,
  useGetProjectDocumentsQuery,
} from "../../api/project-documents.api";
import type { WorkspaceDocumentCategory } from "../../types/project-documents.types";

const CATEGORIES: { value: WorkspaceDocumentCategory; label: string }[] = [
  { value: "Project", label: "Project" },
  { value: "Phase", label: "Phase" },
  { value: "Milestone", label: "Milestone" },
  { value: "SignOff", label: "Sign-off" },
  { value: "Technical", label: "Technical" },
  { value: "Task", label: "Task" },
];

function formatBytes(size: number | null | undefined) {
  if (size == null || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface ProjectDocumentsPanelProps {
  projectId: string;
  canUpload?: boolean;
}

export function ProjectDocumentsPanel({
  projectId,
  canUpload = true,
}: ProjectDocumentsPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<WorkspaceDocumentCategory | "all">("all");
  const [uploadCategory, setUploadCategory] = useState<WorkspaceDocumentCategory>("Project");
  const [phaseId, setPhaseId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [preview, setPreview] = useState<{
    storageKey: string;
    filename: string;
    url?: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryArgs = useMemo(
    () => ({
      projectId,
      category: categoryFilter === "all" ? undefined : categoryFilter,
    }),
    [projectId, categoryFilter],
  );

  const { data: documents = [], isLoading, isError } = useGetProjectDocumentsQuery(queryArgs);
  const { data: phases = [], isLoading: isPhasesLoading } = useGetPhasesQuery(projectId);
  const { data: milestones = [], isLoading: isMilestonesLoading } =
    useGetMilestonesQuery(projectId);
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [createDocument, { isLoading: isCreating }] = useCreateProjectDocumentMutation();
  const [deleteDocument, { isLoading: isDeleting }] = useDeleteProjectDocumentMutation();

  const busy = isUploading || isCreating || isDeleting;

  async function handleUpload(file: File) {
    if (uploadCategory === "Phase" && !phaseId) {
      toast.error("Select a phase for phase documents");
      return;
    }
    if (uploadCategory === "Milestone" && !milestoneId) {
      toast.error("Select a milestone for milestone documents");
      return;
    }

    try {
      const uploaded = await uploadFile(file).unwrap();
      await createDocument({
        projectId,
        storageKey: uploaded.storageKey || uploaded.file.path,
        filename: uploaded.filename || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
        category: uploadCategory,
        phaseId: uploadCategory === "Phase" ? phaseId : undefined,
        milestoneId: uploadCategory === "Milestone" ? milestoneId : undefined,
      }).unwrap();
      toast.success("Document uploaded");
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to upload document",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await deleteDocument({ projectId, documentId }).unwrap();
      toast.success("Document removed");
    } catch {
      toast.error("Failed to remove document");
    }
  }

  const uploadBlocked =
    busy ||
    (uploadCategory === "Phase" && !phaseId) ||
    (uploadCategory === "Milestone" && !milestoneId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Project documents</h2>
          <p className="text-xs text-muted-foreground">
            Attach files by level: project, phase, milestone, sign-off, or technical.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Filter
            </Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                if (v) setCategoryFilter(v as WorkspaceDocumentCategory | "all");
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {canUpload && (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Upload as
              </Label>
              <Select
                value={uploadCategory}
                onValueChange={(v) => {
                  if (!v) return;
                  setUploadCategory(v as WorkspaceDocumentCategory);
                  if (v !== "Phase") setPhaseId("");
                  if (v !== "Milestone") setMilestoneId("");
                }}
              >
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== "Task").map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uploadCategory === "Phase" && (
              <div className="space-y-1">
                <Label
                  htmlFor="phase-doc-select"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  Phase
                </Label>
                <select
                  id="phase-doc-select"
                  className="flex h-9 w-[240px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none"
                  value={phaseId}
                  disabled={isPhasesLoading}
                  onChange={(e) => setPhaseId(e.target.value)}
                >
                  <option value="">
                    {isPhasesLoading ? "Loading phases…" : "Select a phase"}
                  </option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {!isPhasesLoading && phases.length === 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    No phases yet. Create one in Manage Roadmap first.
                  </p>
                )}
              </div>
            )}

            {uploadCategory === "Milestone" && (
              <div className="space-y-1">
                <Label
                  htmlFor="milestone-doc-select"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  Milestone
                </Label>
                <select
                  id="milestone-doc-select"
                  className="flex h-9 w-[240px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none"
                  value={milestoneId}
                  disabled={isMilestonesLoading}
                  onChange={(e) => setMilestoneId(e.target.value)}
                >
                  <option value="">
                    {isMilestonesLoading ? "Loading milestones…" : "Select a milestone"}
                  </option>
                  {milestones.map((m) => {
                    const date = new Date(m.targetDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <option key={m.id} value={m.id}>
                        {m.title} ({date})
                      </option>
                    );
                  })}
                </select>
                {!isMilestonesLoading && milestones.length === 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    No milestones yet. Create one in Manage Roadmap first.
                  </p>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5"
              disabled={uploadBlocked}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Upload
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Task files stay on each task&apos;s Files tab. Phase/milestone files can also be
            attached while creating them in Manage Roadmap.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading documents...
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load documents.</p>
      )}

      {!isLoading && !isError && documents.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <Paperclip className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs text-muted-foreground">Upload a file to get started.</p>
        </div>
      )}

      {!isLoading && documents.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60">
          <ul className="divide-y divide-border/60">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="truncate text-left text-sm font-medium hover:underline"
                    onClick={() =>
                      setPreview({
                        storageKey: doc.s3Key,
                        filename: doc.filename,
                        url: doc.url,
                      })
                    }
                  >
                    {doc.filename}
                  </button>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {doc.category}
                    {doc.phase?.name ? ` · phase: ${doc.phase.name}` : ""}
                    {doc.milestone?.title ? ` · milestone: ${doc.milestone.title}` : ""}
                    {doc.task?.title ? ` · task: ${doc.task.title}` : ""}
                    {" · "}
                    {formatBytes(doc.sizeBytes)}
                    {" · "}
                    {doc.uploader?.displayName ?? "Unknown"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPreview({
                      storageKey: doc.s3Key,
                      filename: doc.filename,
                      url: doc.url,
                    })
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                  title="Preview"
                >
                  <Eye className="size-4" />
                </button>
                <SecureFileLink
                  storageKey={doc.s3Key}
                  filename={doc.filename}
                  showLabel
                  label="Open"
                  className="text-xs text-primary hover:underline"
                />
                {canUpload && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    onClick={() => void handleDelete(doc.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <FilePreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          storageKey={preview.storageKey}
          filename={preview.filename}
          url={preview.url}
        />
      )}
    </div>
  );
}
