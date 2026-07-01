"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/utils/cn";

type ImportPreviewScrollAreaProps = {
  children: React.ReactNode;
  minWidth?: number;
  maxHeightClassName?: string;
  hint?: string;
};

const HIDDEN_HORIZONTAL_SCROLLBAR_CLASS =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export function ImportPreviewScrollArea({
  children,
  minWidth = 2000,
  maxHeightClassName = "max-h-[min(420px,50vh)]",
  hint = "Scroll horizontally to view all columns",
}: ImportPreviewScrollAreaProps) {
  const verticalRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vertical = verticalRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const spacer = spacerRef.current;
    if (!viewport || !track || !spacer) return;

    let syncing = false;

    const syncSpacerWidth = () => {
      spacer.style.width = `${viewport.scrollWidth}px`;
    };

    const syncFromViewport = () => {
      if (syncing) return;
      syncing = true;
      track.scrollLeft = viewport.scrollLeft;
      syncing = false;
    };

    const syncFromTrack = () => {
      if (syncing) return;
      syncing = true;
      viewport.scrollLeft = track.scrollLeft;
      syncing = false;
    };

    const forwardHorizontalWheel = (event: WheelEvent) => {
      if (viewport.scrollWidth <= viewport.clientWidth) return;
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;

      const atLeft = viewport.scrollLeft <= 0;
      const atRight =
        viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1;
      const scrollingLeft = event.deltaX < 0;
      const scrollingRight = event.deltaX > 0;

      if ((scrollingLeft && atLeft) || (scrollingRight && atRight)) return;

      event.preventDefault();
      viewport.scrollLeft += event.deltaX;
    };

    syncSpacerWidth();
    const observer = new ResizeObserver(syncSpacerWidth);
    observer.observe(viewport);

    viewport.addEventListener("scroll", syncFromViewport, { passive: true });
    track.addEventListener("scroll", syncFromTrack, { passive: true });
    viewport.addEventListener("wheel", forwardHorizontalWheel, { passive: false });
    vertical?.addEventListener("wheel", forwardHorizontalWheel, { passive: false });

    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", syncFromViewport);
      track.removeEventListener("scroll", syncFromTrack);
      viewport.removeEventListener("wheel", forwardHorizontalWheel);
      vertical?.removeEventListener("wheel", forwardHorizontalWheel);
    };
  }, [children]);

  return (
    <div className="flex min-h-0 flex-col">
      <div
        ref={verticalRef}
        className={cn("w-full overflow-y-auto overflow-x-hidden", maxHeightClassName)}
      >
        <div
          ref={viewportRef}
          className={cn("w-full overflow-x-auto overflow-y-visible", HIDDEN_HORIZONTAL_SCROLLBAR_CLASS)}
        >
          <div style={{ minWidth }}>{children}</div>
        </div>
      </div>
      <div
        ref={trackRef}
        aria-label="Horizontal scroll"
        className={cn(
          "h-3.5 shrink-0 overflow-x-auto overflow-y-hidden border-t border-border/60 bg-muted/40",
          "[scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:h-3",
          "[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/50",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/45",
          "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/65",
        )}
      >
        <div ref={spacerRef} className="h-px" aria-hidden />
      </div>
      {hint ? (
        <p className="border-t border-border/50 bg-muted/20 px-3 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
