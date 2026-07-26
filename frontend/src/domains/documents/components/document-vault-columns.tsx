"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType2,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import type { WorkspaceDocument } from "../types/documents.types";

const PROJECT_DOT_HEX = [
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

/** Stable distinct avatar fills (inline hex so Tailwind can't purge / collapse them). */
const AVATAR_HEX = [
  "#2563eb", // blue
  "#16a34a", // green
  "#ca8a04", // yellow
  "#db2777", // pink
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#ea580c", // orange
  "#4f46e5", // indigo
  "#059669", // emerald
  "#e11d48", // rose
  "#9333ea", // purple
  "#0d9488", // teal
  "#dc2626", // red
  "#65a30d", // lime
  "#0284c7", // sky
];

function hashIndex(input: string, size: number) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function avatarBg(input: string) {
  return AVATAR_HEX[hashIndex(input, AVATAR_HEX.length)];
}

function projectDotBg(input: string) {
  return PROJECT_DOT_HEX[hashIndex(input, PROJECT_DOT_HEX.length)];
}

const FILENAME_MAX_LEN = 32;

export function formatDocumentBytes(size: number | null | undefined) {
  if (size == null || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function truncateFilename(name: string, max = FILENAME_MAX_LEN) {
  if (name.length <= max) return name;
  const extIdx = name.lastIndexOf(".");
  const ext =
    extIdx > 0 && name.length - extIdx <= 8 ? name.slice(extIdx) : "";
  const baseBudget = Math.max(10, max - ext.length - 1);
  return `${name.slice(0, baseBudget)}…${ext}`;
}

function getInitials(name?: string) {
  if (!name?.trim()) return "?";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function extensionOf(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.at(-1)?.toLowerCase() ?? "") : "";
}

export function documentFileIcon(doc: WorkspaceDocument) {
  const mime = (doc.mimeType ?? "").toLowerCase();
  const ext = extensionOf(doc.filename);

  if (mime.includes("pdf") || ext === "pdf") {
    return { Icon: FileType2, className: "text-rose-500 bg-rose-500/10" };
  }
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)
  ) {
    return { Icon: ImageIcon, className: "text-sky-500 bg-sky-500/10" };
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(ext)
  ) {
    return { Icon: FileSpreadsheet, className: "text-emerald-600 bg-emerald-500/10" };
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return { Icon: FileArchive, className: "text-amber-600 bg-amber-500/10" };
  }
  if (
    mime.includes("javascript") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    ["js", "ts", "tsx", "jsx", "json", "xml", "html", "css", "py"].includes(ext)
  ) {
    return { Icon: FileCode, className: "text-indigo-500 bg-indigo-500/10" };
  }
  if (
    mime.includes("word") ||
    mime.includes("text") ||
    ["doc", "docx", "txt", "md", "rtf"].includes(ext)
  ) {
    return { Icon: FileText, className: "text-blue-600 bg-blue-500/10" };
  }
  return { Icon: File, className: "text-muted-foreground bg-muted" };
}

type DocumentVaultColumnHandlers = {
  onPreview: (doc: WorkspaceDocument) => void;
  onOpenProject: (projectId: string) => void;
  onDelete?: (doc: WorkspaceDocument) => void;
  canDelete: boolean;
};

export function createDocumentVaultColumns({
  onPreview,
  onOpenProject,
  onDelete,
  canDelete,
}: DocumentVaultColumnHandlers): ColumnDef<WorkspaceDocument>[] {
  return [
    {
      id: "filename",
      accessorKey: "filename",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const doc = row.original;
        const { Icon, className } = documentFileIcon(doc);
        const displayName = truncateFilename(doc.filename);
        return (
          <div className="flex max-w-[280px] items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                className,
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <button
                type="button"
                className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:underline"
                title={doc.filename}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(doc);
                }}
              >
                {displayName}
              </button>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatDocumentDate(doc.createdAt)}
                {doc.category ? ` · ${doc.category}` : ""}
              </p>
            </div>
          </div>
        );
      },
      meta: { className: "max-w-[280px] min-w-[220px]", label: "Name" },
    },
    {
      id: "project",
      accessorFn: (row) => row.project?.name ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        const doc = row.original;
        const name = doc.project?.name ?? "Unknown project";
        return (
          <button
            type="button"
            className="inline-flex max-w-[180px] items-center gap-2 text-left text-sm text-foreground hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProject(doc.projectId);
            }}
            title={name}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: projectDotBg(doc.projectId) }}
            />
            <span className="truncate">{name}</span>
          </button>
        );
      },
      meta: { className: "min-w-[160px] max-w-[200px]", label: "Project" },
    },
    {
      id: "uploader",
      accessorFn: (row) => row.uploader?.displayName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Uploaded By" />
      ),
      cell: ({ row }) => {
        const uploader = row.original.uploader;
        const name = uploader?.displayName ?? "Unknown";
        const colorKey = uploader?.id || uploader?.email || name;
        return (
          <div className="flex min-w-[150px] max-w-[200px] items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: avatarBg(colorKey) }}
              title={name}
            >
              {getInitials(name)}
            </span>
            <span className="truncate text-sm text-foreground" title={name}>
              {name}
            </span>
          </div>
        );
      },
      meta: { className: "min-w-[160px]", label: "Uploaded By" },
    },
    {
      id: "sizeBytes",
      accessorKey: "sizeBytes",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Size" />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDocumentBytes(row.original.sizeBytes)}
        </span>
      ),
      meta: { className: "w-[100px]", label: "Size" },
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div
            className="flex items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary"
              title="Preview"
              onClick={() => onPreview(doc)}
            >
              <Eye className="size-4" />
            </Button>
            <SecureFileLink
              storageKey={doc.s3Key}
              filename={doc.filename}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary hover:no-underline"
              iconClassName="size-4"
            />
            {canDelete && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                title="Delete document"
                onClick={() => onDelete(doc)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: {
        className: canDelete ? "w-[120px]" : "w-[88px]",
        sticky: "right",
        label: "Actions",
      },
    },
  ];
}
