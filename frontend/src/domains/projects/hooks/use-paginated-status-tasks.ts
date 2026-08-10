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

/**
 * Option B: one paginated query per status column (top-level tasks only).
 * Pages append via "Load more"; filter changes reset to page 1.
 */
export function usePaginatedStatusTasks(
  status: TaskStatus,
  filters: StatusColumnFilters,
  options?: { pageSize?: number; skip?: boolean },
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GanttTaskRow[]>([]);

  const queryArgs = useMemo((): GetTasksParams => {
    const params: GetTasksParams = {
      projectId: filters.projectId,
      status,
      page,
      limit: pageSize,
    };
    const trimmed = filters.search?.trim();
    if (trimmed) {
      params.search = trimmed;
      params.topLevelOnly = false;
    }
    if (filters.priority) params.priority = filters.priority;
    if (filters.phaseId) params.phaseId = filters.phaseId;
    if (filters.ownerId) params.ownerId = filters.ownerId;
    return params;
  }, [
    filters.projectId,
    filters.search,
    filters.priority,
    filters.phaseId,
    filters.ownerId,
    status,
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
        ownerId: filters.ownerId || "",
        status,
        pageSize,
      }),
    [
      filters.projectId,
      filters.search,
      filters.priority,
      filters.phaseId,
      filters.ownerId,
      status,
      pageSize,
    ],
  );

  // Reset accumulation when filters change.
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
  // Prefer server total when known; else fall back to loaded length.
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
