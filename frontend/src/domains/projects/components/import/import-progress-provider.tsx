"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { api } from "@/core/api/api";
import {
  IMPORT_JOB_POLLING_MS,
  useGetImportJobStatusQuery,
  useGetQueuedImportQuery,
  type ImportJobStatus,
} from "@/domains/projects/api/imports.api";
import { ImportProgressCard } from "@/domains/projects/components/import/import-progress-card";
import {
  IMPORT_QUEUE_MODAL_CLOSED,
  ImportQueueModal,
  type ImportQueueModalState,
} from "@/domains/projects/components/import/import-queue-modal";

export type TrackedImportKind =
  | "mpp"
  | "mpp-portfolio"
  | "excel-tasks"
  | "excel-projects";

export type TrackImportInput = {
  jobId: string;
  label: string;
  kind: TrackedImportKind;
  /** Called once when the job finishes successfully. */
  onComplete?: (status: ImportJobStatus) => void;
  /** Called once when the job fails. */
  onError?: (message: string) => void;
};

export type TrackQueuedImportInput = {
  queueId: string;
  position?: number;
  maxPerUser?: number;
  label: string;
  kind: TrackedImportKind;
  onComplete?: (status: ImportJobStatus) => void;
  onError?: (message: string) => void;
};

type ImportProgressContextValue = {
  active: TrackImportInput | null;
  minimized: boolean;
  status: ImportJobStatus | null;
  isRunning: boolean;
  trackImport: (input: TrackImportInput) => void;
  trackQueuedImport: (input: TrackQueuedImportInput) => void;
  showQueueFull: (maxPerUser?: number) => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
};

const ImportProgressContext = createContext<ImportProgressContextValue | null>(
  null,
);

function kindLabel(kind: TrackedImportKind): string {
  switch (kind) {
    case "mpp":
      return "MS Project import";
    case "mpp-portfolio":
      return "MS Project portfolio";
    case "excel-tasks":
      return "Excel tasks import";
    case "excel-projects":
      return "Excel projects import";
    default:
      return "Import";
  }
}

export function ImportProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const [active, setActive] = useState<TrackImportInput | null>(null);
  const [pendingQueued, setPendingQueued] = useState<TrackQueuedImportInput | null>(
    null,
  );
  const [minimized, setMinimized] = useState(true);
  const [queueModal, setQueueModal] = useState<ImportQueueModalState>(
    IMPORT_QUEUE_MODAL_CLOSED,
  );
  const handledOutcomeRef = useRef<string | null>(null);
  const promotedQueueIdRef = useRef<string | null>(null);

  const jobId = active?.jobId ?? "";
  const { data: status } = useGetImportJobStatusQuery(jobId, {
    skip: !jobId,
    pollingInterval: jobId ? IMPORT_JOB_POLLING_MS : 0,
  });

  const queueId = pendingQueued?.queueId ?? "";
  const { data: queuedStatus } = useGetQueuedImportQuery(queueId, {
    skip: !queueId,
    pollingInterval: queueId ? IMPORT_JOB_POLLING_MS : 0,
  });

  const isRunning = Boolean(
    active &&
      status &&
      (status.status === "waiting" ||
        status.status === "active" ||
        status.status === "delayed" ||
        status.status === "paused"),
  );

  const clearActive = useCallback(() => {
    setActive(null);
    setMinimized(true);
    handledOutcomeRef.current = null;
  }, []);

  const trackImport = useCallback((input: TrackImportInput) => {
    handledOutcomeRef.current = null;
    setPendingQueued(null);
    setActive(input);
    setMinimized(false);
  }, []);

  const trackQueuedImport = useCallback((input: TrackQueuedImportInput) => {
    promotedQueueIdRef.current = null;
    setPendingQueued(input);
    setQueueModal({
      open: true,
      mode: "queued",
      position: input.position ?? 1,
      maxPerUser: input.maxPerUser ?? 20,
    });
  }, []);

  const showQueueFull = useCallback((maxPerUser = 20) => {
    setQueueModal({ open: true, mode: "full", maxPerUser });
  }, []);

  const closeQueueModal = useCallback(() => {
    setQueueModal(IMPORT_QUEUE_MODAL_CLOSED);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const dismiss = useCallback(() => {
    if (isRunning || pendingQueued) {
      setMinimized(true);
      return;
    }
    clearActive();
  }, [clearActive, isRunning, pendingQueued]);

  // Promote queued import to active tracking once the worker starts it.
  useEffect(() => {
    if (!pendingQueued || !queuedStatus) return;
    if (queuedStatus.status === "started" && queuedStatus.jobId) {
      if (promotedQueueIdRef.current === pendingQueued.queueId) return;
      promotedQueueIdRef.current = pendingQueued.queueId;
      const { label, kind, onComplete, onError } = pendingQueued;
      setPendingQueued(null);
      trackImport({
        jobId: queuedStatus.jobId,
        label,
        kind,
        onComplete,
        onError,
      });
      return;
    }
    if (queuedStatus.status === "unknown") {
      const onError = pendingQueued.onError;
      setPendingQueued(null);
      const message = "Queued import expired or was not found";
      onError?.(message);
      if (!onError) toast.error(message);
    }
  }, [pendingQueued, queuedStatus, trackImport]);

  useEffect(() => {
    if (!active || !status || status.jobId !== active.jobId) return;

    const terminal =
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "unknown";
    if (!terminal) return;

    const outcomeKey = `${status.jobId}:${status.status}`;
    if (handledOutcomeRef.current === outcomeKey) return;
    handledOutcomeRef.current = outcomeKey;

    if (status.status === "completed") {
      setMinimized(false);
      active.onComplete?.(status);
      dispatch(
        api.util.invalidateTags([
          { type: "Projects", id: "LIST" },
          { type: "Tasks", id: "LIST" },
          { type: "TaskDependencies", id: "LIST" },
        ]),
      );
      if (!active.onComplete) {
        toast.success(`${kindLabel(active.kind)} completed`);
      }
      const t = window.setTimeout(() => clearActive(), 4000);
      return () => window.clearTimeout(t);
    }

    const message = status.failedReason || `${kindLabel(active.kind)} failed`;
    setMinimized(false);
    active.onError?.(message);
    if (!active.onError) {
      toast.error(message);
    }
    const t = window.setTimeout(() => clearActive(), 6000);
    return () => window.clearTimeout(t);
  }, [active, status, dispatch, clearActive]);

  const value = useMemo<ImportProgressContextValue>(
    () => ({
      active,
      minimized,
      status: status ?? null,
      isRunning: Boolean(active) && (isRunning || !status),
      trackImport,
      trackQueuedImport,
      showQueueFull,
      minimize,
      expand,
      dismiss,
    }),
    [
      active,
      minimized,
      status,
      isRunning,
      trackImport,
      trackQueuedImport,
      showQueueFull,
      minimize,
      expand,
      dismiss,
    ],
  );

  return (
    <ImportProgressContext.Provider value={value}>
      {children}
      {active ? (
        <ImportProgressCard
          label={active.label || kindLabel(active.kind)}
          kind={active.kind}
          status={status ?? null}
          minimized={minimized}
          onMinimize={minimize}
          onExpand={expand}
          onDismiss={dismiss}
        />
      ) : null}
      <ImportQueueModal state={queueModal} onClose={closeQueueModal} />
    </ImportProgressContext.Provider>
  );
}

export function useImportProgress() {
  const ctx = useContext(ImportProgressContext);
  if (!ctx) {
    throw new Error("useImportProgress must be used within ImportProgressProvider");
  }
  return ctx;
}

/** Optional hook when provider may be absent (should not happen in app). */
export function useImportProgressOptional() {
  return useContext(ImportProgressContext);
}
