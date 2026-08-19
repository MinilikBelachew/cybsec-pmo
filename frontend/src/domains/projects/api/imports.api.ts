import { api } from "@/core/api/api";

export type ImportJobStatus = {
  jobId: string;
  status:
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed"
    | "paused"
    | "unknown";
  progress: number;
  step: string | null;
  kind: string | null;
  result: Record<string, unknown> | null;
  failedReason: string | null;
};

export type ActiveImportJob = {
  jobId: string | null;
  kind: string | null;
  status: "waiting" | "active" | "delayed" | "paused" | null;
  progress: number;
  step: string | null;
  queuedCount?: number;
  maxPerUser?: number;
};

export type ImportEnqueueResult = {
  status: "started" | "queued";
  jobId?: string | null;
  queueId?: string | null;
  position?: number;
  pendingCount?: number;
  totalCount?: number;
  maxPerUser?: number;
  activeJobId?: string | null;
};

export type QueuedImportStatus = {
  status: "queued" | "started" | "unknown";
  jobId?: string | null;
  position?: number;
  pendingCount?: number;
  maxPerUser?: number;
};

export type ExcelTasksPreviewRow = {
  title: string;
  description: string;
  priority: string;
  status: string;
  assigneeName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  effortHours: number;
  durationDays?: number;
  baselineStart?: string;
  baselineEnd?: string;
  baselineDurationDays?: number;
  actualStart?: string;
  actualEnd?: string;
  progressApproved?: number;
  predecessors?: Array<{
    title: string;
    depType?: string;
    lagDays?: number;
  }>;
  parentTaskTitle?: string;
  resolvedAssigneeId?: string | null;
  resolvedPhaseId?: string | null;
  importMode: "create" | "update";
  resolvedTaskId?: string;
  errors: string[];
  warnings: string[];
  isSummary?: boolean;
  isMilestone?: boolean;
};

export type ExcelTasksPreviewCounts = {
  total: number;
  valid: number;
  invalid: number;
  create: number;
  update: number;
};

export type ExcelTasksPreviewResult = {
  previewId: string;
  rows: ExcelTasksPreviewRow[];
  counts: ExcelTasksPreviewCounts;
  existingTasks: Array<{ id: string; title: string; parentTitle?: string | null }>;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type ExcelTasksPreviewPage = {
  rows: ExcelTasksPreviewRow[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type ExcelProjectsPreviewPage = {
  rows: unknown[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type ExcelProjectsPreviewResult = {
  previewId: string;
  counts: {
    projectsTotal: number;
    projectsValid: number;
    phasesTotal: number;
    tasksTotal: number;
    milestonesTotal: number;
  };
  nestedCounts: Record<
    string,
    { phases: number; tasks: number; milestones: number }
  >;
  projects: Record<string, unknown>[];
  projectsTotal: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export const IMPORT_JOB_POLLING_MS = 1500;

export const importsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getActiveImport: builder.query<ActiveImportJob, void>({
      query: () => ({ url: "/imports/active", method: "GET" }),
    }),

    getQueuedImport: builder.query<QueuedImportStatus, string>({
      query: (queueId) => ({
        url: `/imports/queued/${encodeURIComponent(queueId)}`,
        method: "GET",
      }),
    }),

    getImportJobStatus: builder.query<ImportJobStatus, string>({
      query: (jobId) => ({
        url: `/imports/jobs/${encodeURIComponent(jobId)}`,
        method: "GET",
      }),
    }),

    previewExcelTasksImport: builder.mutation<
      ExcelTasksPreviewResult,
      { projectId: string; file: File }
    >({
      query: ({ projectId, file }) => {
        const formData = new FormData();
        formData.append("projectId", projectId);
        formData.append("file", file);
        return {
          url: "/imports/excel/tasks/preview",
          method: "POST",
          body: formData,
        };
      },
    }),

    pageExcelTasksPreview: builder.query<
      ExcelTasksPreviewPage,
      { previewId: string; offset?: number; limit?: number }
    >({
      query: ({ previewId, offset = 0, limit = 50 }) => {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(limit),
        });
        return {
          url: `/imports/excel/tasks/preview/${encodeURIComponent(previewId)}?${params}`,
          method: "GET",
        };
      },
    }),

    patchExcelTasksPreviewRow: builder.mutation<
      { row: ExcelTasksPreviewRow },
      { previewId: string; index: number; patch: Record<string, unknown> }
    >({
      query: ({ previewId, ...body }) => ({
        url: `/imports/excel/tasks/preview/${encodeURIComponent(previewId)}/row`,
        method: "PATCH",
        body,
      }),
    }),

    confirmExcelTasksImport: builder.mutation<
      ImportEnqueueResult,
      { previewId: string; projectId: string }
    >({
      query: ({ previewId }) => ({
        url: "/imports/excel/tasks/confirm",
        method: "POST",
        body: { previewId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: projectId },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),

    startExcelTasksImport: builder.mutation<
      ImportEnqueueResult,
      { projectId: string; rows: Record<string, unknown>[] }
    >({
      query: (body) => ({
        url: "/imports/excel/tasks",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: projectId },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),

    previewExcelProjectsImport: builder.mutation<
      ExcelProjectsPreviewResult,
      { file: File }
    >({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: "/imports/excel/projects/preview",
          method: "POST",
          body: formData,
        };
      },
    }),

    pageExcelProjectsPreview: builder.query<
      ExcelProjectsPreviewPage,
      {
        previewId: string;
        entity: "projects" | "phases" | "tasks" | "milestones";
        projectName?: string;
        offset?: number;
        limit?: number;
      }
    >({
      query: ({ previewId, entity, projectName, offset = 0, limit = 50 }) => {
        const params = new URLSearchParams({
          entity,
          offset: String(offset),
          limit: String(limit),
        });
        if (projectName) params.set("projectName", projectName);
        return {
          url: `/imports/excel/projects/preview/${encodeURIComponent(previewId)}?${params}`,
          method: "GET",
        };
      },
    }),

    patchExcelProjectsPreviewRow: builder.mutation<
      { row: unknown },
      {
        previewId: string;
        entity: "projects" | "phases" | "tasks" | "milestones";
        index: number;
        projectName?: string;
        patch: Record<string, unknown>;
      }
    >({
      query: ({ previewId, ...body }) => ({
        url: `/imports/excel/projects/preview/${encodeURIComponent(previewId)}/row`,
        method: "PATCH",
        body,
      }),
    }),

    confirmExcelProjectsImport: builder.mutation<
      ImportEnqueueResult,
      { previewId: string }
    >({
      query: (body) => ({
        url: "/imports/excel/projects/confirm",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Projects", id: "LIST" },
        { type: "Tasks", id: "LIST" },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),

    startExcelProjectsImport: builder.mutation<
      ImportEnqueueResult,
      {
        projects: Record<string, unknown>[];
        phasesByProject?: Record<string, Record<string, unknown>[]>;
        tasksByProject?: Record<string, Record<string, unknown>[]>;
        milestonesByProject?: Record<string, Record<string, unknown>[]>;
      }
    >({
      query: (body) => ({
        url: "/imports/excel/projects",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Projects", id: "LIST" },
        { type: "Tasks", id: "LIST" },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetActiveImportQuery,
  useLazyGetActiveImportQuery,
  useGetQueuedImportQuery,
  useLazyGetQueuedImportQuery,
  useGetImportJobStatusQuery,
  useLazyGetImportJobStatusQuery,
  usePreviewExcelTasksImportMutation,
  useLazyPageExcelTasksPreviewQuery,
  usePatchExcelTasksPreviewRowMutation,
  useConfirmExcelTasksImportMutation,
  useStartExcelTasksImportMutation,
  usePreviewExcelProjectsImportMutation,
  useLazyPageExcelProjectsPreviewQuery,
  usePatchExcelProjectsPreviewRowMutation,
  useConfirmExcelProjectsImportMutation,
  useStartExcelProjectsImportMutation,
} = importsApi;

/** Poll until completed/failed. Throws on failure. */
export async function waitForImportJob(
  fetchStatus: (jobId: string) => Promise<ImportJobStatus>,
  jobId: string,
  onProgress?: (status: ImportJobStatus) => void,
  intervalMs = IMPORT_JOB_POLLING_MS,
): Promise<ImportJobStatus> {
  for (;;) {
    const status = await fetchStatus(jobId);
    onProgress?.(status);
    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "unknown") {
      throw new Error(status.failedReason || "Import failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Poll until a queued import is started and returns its Bull job id. */
export async function waitForQueuedImport(
  fetchQueued: (queueId: string) => Promise<QueuedImportStatus>,
  queueId: string,
  intervalMs = IMPORT_JOB_POLLING_MS,
): Promise<string> {
  for (;;) {
    const status = await fetchQueued(queueId);
    if (status.status === "started" && status.jobId) {
      return status.jobId;
    }
    if (status.status === "unknown") {
      throw new Error("Queued import expired or was not found");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function importErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as { data?: { code?: string } };
  return err.data?.code;
}

export function isImportQueueFullError(error: unknown): boolean {
  return importErrorCode(error) === "IMPORT_QUEUE_FULL";
}

export function importQueueFullMax(error: unknown, fallback = 20): number {
  if (!error || typeof error !== "object") return fallback;
  const err = error as { data?: { maxPerUser?: number } };
  return typeof err.data?.maxPerUser === "number" ? err.data.maxPerUser : fallback;
}

/** @deprecated Prefer queued responses; kept for legacy 409s. */
export function isImportAlreadyRunningError(error: unknown): boolean {
  return importErrorCode(error) === "IMPORT_ALREADY_RUNNING";
}
