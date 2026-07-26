"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/routing";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { DataTable } from "@/shared/components/data-table";
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FilePreviewModal } from "@/domains/projects/components/tasks/file-preview-modal";
import { ProjectDocumentsPanel } from "@/domains/projects/components/documents/project-documents-panel";
import { useGetProjectsQuery } from "@/domains/projects";
import { useDeleteProjectDocumentMutation } from "@/domains/projects/api/project-documents.api";
import { useLazyGetFileAccessUrlQuery } from "@/domains/projects/api/files.api";
import { useModulePermissions } from "@/domains/auth";
import { ProjectFilterSelect } from "@/domains/tasks/components/project-filter-select";
import {
  useGetDocumentVaultStatsQuery,
  useGetVaultDocumentsQuery,
} from "../api/documents.api";
import type {
  WorkspaceDocument,
  WorkspaceDocumentCategory,
} from "../types/documents.types";
import { createDocumentVaultColumns } from "./document-vault-columns";

const CATEGORY_OPTIONS: { value: WorkspaceDocumentCategory | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "Project", label: "Project" },
  { value: "Phase", label: "Phase" },
  { value: "Milestone", label: "Milestone" },
  { value: "SignOff", label: "Sign-off" },
  { value: "Technical", label: "Technical" },
  { value: "Task", label: "Task" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function DocumentVaultPage() {
  const router = useRouter();
  const { canEditProjects } = useModulePermissions();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<WorkspaceDocumentCategory | "all">(
    "all",
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showUpload, setShowUpload] = useState(false);
  const [bulkActive, setBulkActive] = useState(true);
  const [selectedRows, setSelectedRows] = useState<WorkspaceDocument[]>([]);
  const [preview, setPreview] = useState<{
    storageKey: string;
    filename: string;
    url?: string | null;
  } | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<WorkspaceDocument[] | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, projectFilter, categoryFilter, pageSize]);

  useEffect(() => {
    if (!bulkActive) setSelectedRows([]);
  }, [bulkActive]);

  const queryParams = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      projectId: projectFilter !== "all" ? projectFilter : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
    }),
    [pageIndex, pageSize, debouncedSearch, projectFilter, categoryFilter],
  );

  const { data, isLoading, isFetching } = useGetVaultDocumentsQuery(queryParams);
  const { data: stats } = useGetDocumentVaultStatsQuery();
  const { data: projectsPage } = useGetProjectsQuery({ page: 1, limit: 100 });
  const [deleteDocument, { isLoading: isDeleting }] =
    useDeleteProjectDocumentMutation();
  const [fetchAccessUrl] = useLazyGetFileAccessUrlQuery();

  const projects = projectsPage?.data ?? [];
  const documents = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageCount =
    data?.meta?.totalPages ??
    (pageSize > 0 ? Math.ceil(total / pageSize) : 0);

  const columns = useMemo(
    () => [
      createSelectColumn<WorkspaceDocument>(),
      ...createDocumentVaultColumns({
        canDelete: canEditProjects,
        onPreview: (doc) =>
          setPreview({
            storageKey: doc.s3Key,
            filename: doc.filename,
            url: doc.url,
          }),
        onOpenProject: (projectId) =>
          router.push(`/dashboard/projects/${projectId}`),
        onDelete: (doc) => setDeleteTargets([doc]),
      }),
    ],
    [canEditProjects, router],
  );

  async function downloadDocuments(docs: WorkspaceDocument[]) {
    if (!docs.length) return;
    setIsBulkDownloading(true);
    let ok = 0;
    let failed = 0;

    const triggerBlobDownload = (blob: Blob, filename: string) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
    };

    const triggerUrlDownload = (url: string, filename: string) => {
      // Iframe avoids popup-blocker (which stops after the first window.open/_blank).
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.setAttribute("data-download", filename);
      iframe.src = url;
      document.body.appendChild(iframe);
      window.setTimeout(() => iframe.remove(), 60_000);
    };

    try {
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]!;
        const filename = doc.filename || `document-${i + 1}`;
        try {
          const result = await fetchAccessUrl({
            storageKey: doc.s3Key,
            filename,
          }).unwrap();

          try {
            const response = await fetch(result.url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            triggerBlobDownload(await response.blob(), filename);
          } catch {
            // CORS / network: still start each file via hidden iframe
            triggerUrlDownload(result.url, filename);
          }

          ok += 1;
          await new Promise((r) => setTimeout(r, 500));
        } catch {
          failed += 1;
        }
      }
      if (ok && !failed) {
        toast.success(
          ok === 1 ? "Download started" : `Started download for ${ok} files`,
        );
      } else if (ok && failed) {
        toast.error(`Downloaded ${ok}, failed ${failed}`);
      } else {
        toast.error("Could not download selected files");
      }
    } finally {
      setIsBulkDownloading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTargets?.length) return;
    const targets = deleteTargets;
    let ok = 0;
    let failed = 0;
    try {
      for (const doc of targets) {
        try {
          await deleteDocument({
            projectId: doc.projectId,
            documentId: doc.id,
          }).unwrap();
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      if (ok && !failed) {
        toast.success(
          ok === 1 ? "Document removed" : `${ok} documents removed`,
        );
      } else if (ok && failed) {
        toast.error(`Deleted ${ok}, failed ${failed}`);
      } else {
        toast.error("Failed to remove documents");
      }
      setDeleteTargets(null);
      setSelectedRows([]);
    } catch {
      toast.error("Failed to remove documents");
    }
  }

  const vaultStats = stats ?? {
    total: 0,
    project: 0,
    phase: 0,
    milestone: 0,
    signOff: 0,
    technical: 0,
    task: 0,
  };

  const selectedCount = selectedRows.length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-10">
      <PageHeader
        title="Document Vault"
        description={
          isFetching && !isLoading
            ? `${vaultStats.total} documents across projects you can access. Refreshing…`
            : `${vaultStats.total} documents across projects you can access.`
        }
        actions={
          canEditProjects && projectFilter !== "all" ? (
            <Button
              type="button"
              size="sm"
              variant={showUpload ? "secondary" : "default"}
              className="gap-1.5"
              onClick={() => setShowUpload((v) => !v)}
            >
              <Upload className="size-3.5" />
              {showUpload ? "Hide upload" : "Upload"}
            </Button>
          ) : null
        }
      />

      {canEditProjects && showUpload && projectFilter !== "all" && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <ProjectDocumentsPanel projectId={projectFilter} canUpload />
        </div>
      )}

      <DataTable
        columns={columns}
        data={documents}
        getRowId={(row) => row.id}
        manual
        searchPlaceholder="Search documents, tags, uploaders…"
        searchValue={search}
        onSearchChange={setSearch}
        pageCount={pageCount}
        totalRows={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        isLoading={isLoading}
        emptyMessage="No documents match your filters."
        minTableWidth="min-w-[960px]"
        onSelectionChange={setSelectedRows}
        bulkSelect={{
          active: bulkActive,
          onActiveChange: setBulkActive,
          actions:
            selectedCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center rounded-full bg-orange-500/15 px-3 text-xs font-semibold text-orange-700 dark:text-orange-300">
                  {selectedCount} selected
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={isBulkDownloading}
                  onClick={() => void downloadDocuments(selectedRows)}
                >
                  {isBulkDownloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Download
                </Button>
                {canEditProjects ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTargets(selectedRows)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null,
        }}
        filters={
          <>
            <ProjectFilterSelect
              value={projectFilter}
              onValueChange={setProjectFilter}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            />
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                if (v) setCategoryFilter(v as WorkspaceDocumentCategory | "all");
              }}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-xl border border-border/50 bg-muted/50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {preview && (
        <FilePreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          storageKey={preview.storageKey}
          filename={preview.filename}
          url={preview.url}
        />
      )}

      <DeleteDialog
        isOpen={!!deleteTargets?.length}
        onClose={() => setDeleteTargets(null)}
        onConfirm={() => void confirmDelete()}
        title={
          deleteTargets && deleteTargets.length > 1
            ? "Delete documents"
            : "Delete document"
        }
        description={
          deleteTargets && deleteTargets.length > 1
            ? `Are you sure you want to delete ${deleteTargets.length} documents? This action cannot be undone.`
            : deleteTargets?.[0]
              ? `Are you sure you want to delete "${deleteTargets[0].filename}"? This action cannot be undone.`
              : "Are you sure you want to delete this document?"
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
