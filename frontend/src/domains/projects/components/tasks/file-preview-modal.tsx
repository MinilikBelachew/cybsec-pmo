"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, FileText } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { useLazyGetFileAccessUrlQuery } from "@/domains/projects/api/files.api";
import { toast } from "react-hot-toast";

interface FilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  filename: string;
  url?: string | null;
  storageKey?: string | null;
  file?: File;
}

export function FilePreviewModal({
  open,
  onClose,
  filename,
  url,
  storageKey,
  file,
}: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string>("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  
  const [fetchAccessUrl, { isFetching: isFetchingSecureUrl }] = useLazyGetFileAccessUrlQuery();

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  const isPdf = ["pdf"].includes(ext);
  const isText = ["txt", "md", "csv", "json", "js", "ts", "css", "html", "xml", "yaml", "yml"].includes(ext);

  // Generate object URL for preview if local File is provided
  useEffect(() => {
    if (!open) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      return;
    }

    if (file) {
      const oUrl = URL.createObjectURL(file);
      setObjectUrl(oUrl);
    }
  }, [open, file]);

  // Load secure access URL if needed
  useEffect(() => {
    if (!open) {
      setFetchedUrl(null);
      return;
    }

    if (file || url) return;

    if (storageKey) {
      const loadSecureUrl = async () => {
        try {
          const result = await fetchAccessUrl({ storageKey, filename }).unwrap();
          setFetchedUrl(result.url);
        } catch {
          toast.error("Could not load secure preview URL");
        }
      };
      void loadSecureUrl();
    }
  }, [open, storageKey, file, url, filename, fetchAccessUrl]);

  const activeUrl = objectUrl || url || fetchedUrl;

  // Read / load text contents
  useEffect(() => {
    if (!open) {
      setTextContent("");
      return;
    }

    if (!isText) return;
    if (!activeUrl) return;

    const readText = async () => {
      setIsLoadingText(true);
      try {
        if (file) {
          const text = await file.text();
          setTextContent(text);
        } else {
          const res = await fetch(activeUrl);
          const text = await res.text();
          setTextContent(text);
        }
      } catch (err) {
        setTextContent("Failed to load file contents for preview.");
      } finally {
        setIsLoadingText(false);
      }
    };

    void readText();
  }, [open, activeUrl, file, isText]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const handleDownload = () => {
    if (!activeUrl) return;
    const link = document.createElement("a");
    link.href = activeUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-sm font-semibold truncate text-foreground leading-tight">
                  {filename}
                </DialogPrimitive.Title>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                  {ext} File
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 gap-1.5"
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close preview"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-[300px] bg-muted/5 dark:bg-card/5">
            {isFetchingSecureUrl ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs">Generating secure preview...</span>
              </div>
            ) : isImage && activeUrl ? (
              <div className="relative max-w-full max-h-[72vh] flex items-center justify-center bg-card rounded-lg border p-2 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeUrl}
                  alt={filename}
                  className="max-w-full max-h-[70vh] object-contain rounded-md"
                />
              </div>
            ) : isPdf && activeUrl ? (
              <object
                data={activeUrl}
                type="application/pdf"
                className="w-full h-[72vh] rounded-xl border bg-background shadow-inner"
              >
                <div className="flex flex-col items-center justify-center p-8 text-center gap-4 max-w-sm mx-auto h-full">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <FileText className="size-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">PDF preview blocked or not supported</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Your browser's security policy is blocking inline PDF viewing, or it is not supported. You can open the PDF in a new tab.
                    </p>
                  </div>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/95 transition"
                  >
                    Open PDF in New Tab
                  </a>
                </div>
              </object>
            ) : isText ? (
              <div className="w-full h-full flex flex-col">
                {isLoadingText ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs">Loading contents...</span>
                  </div>
                ) : (
                  <pre className="w-full max-h-[72vh] overflow-auto rounded-xl border bg-muted/40 p-5 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                    {textContent}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-4 max-w-sm">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">No preview available</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    We don't support online previews for this file type yet. You can still download the file to view it locally.
                  </p>
                </div>
                {activeUrl && (
                  <Button type="button" onClick={handleDownload} className="gap-2">
                    <Download className="size-4" />
                    Download File
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
