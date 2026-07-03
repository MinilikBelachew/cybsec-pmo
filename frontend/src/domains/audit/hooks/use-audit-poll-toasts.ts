"use client";

import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import type { AuditLogEntry } from "../api/audit.api";
import {
  formatAuditActivityToast,
  isNotableAuditAction,
} from "../utils/audit-notable-actions";

const MAX_TOASTS_PER_POLL = 3;

type UseAuditPollToastsOptions = {
  entries: AuditLogEntry[];
  isLoading: boolean;
  isFetching: boolean;
  /** Only surface background toasts on the first page (newest events). */
  enabled?: boolean;
  /** When this value changes, seen events are reset (e.g. filters or project scope). */
  resetKey?: string;
};

/**
 * Shows toasts when polling discovers new notable audit events (exports, deletes, permission changes, etc.).
 */
export function useAuditPollToasts({
  entries,
  isLoading,
  isFetching,
  enabled = true,
  resetKey = "",
}: UseAuditPollToastsOptions): void {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const wasFetchingRef = useRef(false);

  useEffect(() => {
    seenIdsRef.current.clear();
    initializedRef.current = false;
    wasFetchingRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) return;

    if (isFetching) {
      wasFetchingRef.current = true;
      return;
    }

    if (isLoading || entries.length === 0) return;

    if (!initializedRef.current) {
      entries.forEach((entry) => seenIdsRef.current.add(entry.id));
      initializedRef.current = true;
      wasFetchingRef.current = false;
      return;
    }

    if (!wasFetchingRef.current) return;
    wasFetchingRef.current = false;

    const newcomers = entries.filter((entry) => !seenIdsRef.current.has(entry.id));
    if (newcomers.length === 0) return;

    newcomers.forEach((entry) => seenIdsRef.current.add(entry.id));

    const notable = newcomers.filter(isNotableAuditAction);
    const toShow = notable.slice(0, MAX_TOASTS_PER_POLL);
    for (const entry of toShow) {
      toast(formatAuditActivityToast(entry), { icon: "📋" });
    }

    if (notable.length > MAX_TOASTS_PER_POLL) {
      toast(`${notable.length - MAX_TOASTS_PER_POLL} more audit events`, { duration: 4000 });
    }
  }, [enabled, entries, isFetching, isLoading]);
}
