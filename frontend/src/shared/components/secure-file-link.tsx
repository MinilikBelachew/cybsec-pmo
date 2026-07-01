"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLazyGetFileAccessUrlQuery } from "@/domains/projects/api/files.api";
import { cn } from "@/shared/utils/cn";

interface SecureFileLinkProps {
  storageKey: string;
  filename?: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
}

export function SecureFileLink({
  storageKey,
  filename,
  label,
  className,
  iconClassName,
  showLabel = false,
}: SecureFileLinkProps) {
  const [fetchAccessUrl, { isFetching }] = useLazyGetFileAccessUrlQuery();
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = async () => {
    if (!storageKey || isOpening || isFetching) return;
    setIsOpening(true);
    try {
      const result = await fetchAccessUrl({ storageKey, filename }).unwrap();
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open file. You may not have access or the link expired.");
    } finally {
      setIsOpening(false);
    }
  };

  const busy = isOpening || isFetching;

  return (
    <button
      type="button"
      onClick={() => void handleOpen()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60",
        className,
      )}
      title={filename ?? label ?? "Open file"}
    >
      {busy ? (
        <Loader2 className={cn("size-3.5 animate-spin", iconClassName)} />
      ) : (
        <ExternalLink className={cn("size-3.5", iconClassName)} />
      )}
      {showLabel && (
        <span className="text-[11px]">{label ?? filename ?? "View file"}</span>
      )}
    </button>
  );
}
