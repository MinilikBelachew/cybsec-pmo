"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import { FilePreviewModal } from "../tasks/file-preview-modal";
import type { WorkspaceDocument } from "../../types/project-documents.types";

type PreviewTarget = {
  storageKey: string;
  filename: string;
  url?: string | null;
};

interface DocumentAttachmentListProps {
  documents: WorkspaceDocument[];
  maxVisible?: number;
  dense?: boolean;
}

export function DocumentAttachmentList({
  documents,
  maxVisible = 4,
  dense = false,
}: DocumentAttachmentListProps) {
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  if (documents.length === 0) return null;

  const visible = documents.slice(0, maxVisible);
  const overflow = documents.length - visible.length;

  return (
    <>
      <ul className={dense ? "space-y-1" : "space-y-1.5"}>
        {visible.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-1.5 py-1"
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground hover:text-primary hover:underline"
              title={doc.filename}
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
            <button
              type="button"
              onClick={() =>
                setPreview({
                  storageKey: doc.s3Key,
                  filename: doc.filename,
                  url: doc.url,
                })
              }
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
              title="Preview file"
            >
              <Eye className="size-3.5" />
            </button>
            <SecureFileLink
              storageKey={doc.s3Key}
              filename={doc.filename}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
              iconClassName="size-3.5"
            />
          </li>
        ))}
        {overflow > 0 && (
          <li className="px-1 text-[10px] text-muted-foreground">+{overflow} more</li>
        )}
      </ul>

      {preview && (
        <FilePreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          storageKey={preview.storageKey}
          filename={preview.filename}
          url={preview.url}
        />
      )}
    </>
  );
}
