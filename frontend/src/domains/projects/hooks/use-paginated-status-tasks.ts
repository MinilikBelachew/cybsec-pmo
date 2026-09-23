"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetTasksQuery } from "../api/tasks.api";
import type { GetTasksParams, Task, TaskPriority, TaskStatus } from "../types/tasks.types";
import { mapTasksToGanttRows, type GanttTaskRow } from "../utils/map-task-to-gantt";

const DEFAULT_PAGE_SIZE = 20;

export type StatusColumnFilters = {
  projectId: string;
  search?: string;
  priority?: TaskPriority;
  phaseId?: string;
  ownerId?: string;
};

type TaskListQueryFilters = StatusColumnFilters & {
  status?: TaskStatus;
  unassignedPhase?: boolean;
};

/**
 * Paginated top-level tasks for one list/board group.
 * Pages append via "Load more"; filter changes reset to page 1.
 */
function usePaginatedTaskList(
  filters: TaskListQueryFilters,
  options?: { pageSize?: number; skip?: boolean },
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GanttTaskRow[]>([]);

  const queryArgs = useMemo((): GetTasksParams => {
    const params: GetTasksParams = {
      projectId: filters.projectId,
      page,
      limit: pageSize,
    };
    if (filters.status) params.status = filters.status;
    const trimmed = filters.search?.trim();
    if (trimmed) {
      params.search = trimmed;
      params.topLevelOnly = false;
    }
    if (filters.priority) params.priority = filters.priority;
    if (filters.phaseId) params.phaseId = filters.phaseId;
    if (filters.unassignedPhase) params.unassignedPhase = true;
    if (filters.ownerId) params.ownerId = filters.ownerId;
    return params;
  }, [
    filters.projectId,
    filters.search,
    filters.priority,
    filters.phaseId,
    filters.unassignedPhase,
    filters.ownerId,
    filters.status,
    page,
    pageSize,
  ]);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        projectId: filters.projectId,
        search: filters.search?.trim() || "",
        priority: filters.priority || "",
        phaseId: filters.phaseId || "",
        unassignedPhase: Boolean(filters.unassignedPhase),
        ownerId: filters.ownerId || "",
        status: filters.status || "",
        pageSize,
      }),
    [
      filters.projectId,
      filters.search,
      filters.priority,
      filters.phaseId,
      filters.unassignedPhase,
      filters.ownerId,
      filters.status,
      pageSize,
    ],
  );

  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [filterKey]);

  const { data, isFetching, isLoading, isError, refetch } = useGetTasksQuery(queryArgs, {
    skip: options?.skip || !filters.projectId,
  });

  useEffect(() => {
    if (!data?.data) return;
    const mapped = mapTasksToGanttRows(data.data as Task[]);
    setRows((prev) => {
      if (page <= 1) return mapped;
      const seen = new Set(prev.map((r) => r.id));
      const appended = mapped.filter((r) => !seen.has(r.id));
      return [...prev, ...appended];
    });
  }, [data, page]);

  const total = data?.meta?.total;
  const hasNextPage = Boolean(data?.hasNextPage);
  const loadedCount = rows.length;

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetching) return;
    setPage((p) => p + 1);
  }, [hasNextPage, isFetching]);

  const resetAndRefetch = useCallback(() => {
    setPage(1);
    setRows([]);
    void refetch();
  }, [refetch]);

  return {
    tasks: rows,
    page,
    pageSize,
    total: typeof total === "number" ? total : loadedCount,
    hasNextPage,
    isLoading: isLoading && page === 1,
    isFetching,
    isError,
    loadMore,
    refetch: resetAndRefetch,
  };
}

/**
 * Option B: one paginated query per status column (top-level tasks only).
 */
export function usePaginatedStatusTasks(
  status: TaskStatus,
  filters: StatusColumnFilters,
  options?: { pageSize?: number; skip?: boolean },
) {
  return usePaginatedTaskList({ ...filters, status }, options);
}

/** One paginated query per phase group (or unassigned when phaseId is null). */
export function usePaginatedPhaseTasks(
  phaseId: string | null,
  filters: StatusColumnFilters,
  options?: { pageSize?: number; skip?: boolean },
) {
  return usePaginatedTaskList(
    {
      ...filters,
      ...(phaseId ? { phaseId } : { unassignedPhase: true }),
    },
    options,
  );
}
