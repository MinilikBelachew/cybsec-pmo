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

type PaginatedTaskListOptions = {
  pageSize?: number;
  skip?: boolean;
  /**
   * Kanban: include nested SUB tasks in the status column so In Progress
   * (etc.) does not empty when search is cleared.
   * List stays top-level-only unless searching.
   */
  includeNestedTasks?: boolean;
};

/**
 * Paginated tasks for one list/board group.
 * Pages append via "Load more"; filter changes reset to page 1.
 */
function usePaginatedTaskList(
  filters: TaskListQueryFilters,
  options?: PaginatedTaskListOptions,
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const includeNestedTasks = Boolean(options?.includeNestedTasks);
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
    } else if (includeNestedTasks) {
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
    includeNestedTasks,
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
        includeNestedTasks,
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
      includeNestedTasks,
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

  const metaTotal = data?.meta?.total;
  const hasNextPage = Boolean(data?.hasNextPage);
  const loadedCount = rows.length;
  // Never report fewer than rows already on screen (guards meta.total: 0 bugs).
  const total =
    typeof metaTotal === "number"
      ? Math.max(metaTotal, loadedCount)
      : loadedCount;

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
    total,
    loadedCount,
    hasNextPage,
    isLoading: isLoading && page === 1,
    isFetching,
    isError,
    loadMore,
    refetch: resetAndRefetch,
  };
}

/**
 * One paginated query per status column.
 * Pass includeNestedTasks for Kanban so nested In Progress cards stay visible.
 */
export function usePaginatedStatusTasks(
  status: TaskStatus,
  filters: StatusColumnFilters,
  options?: PaginatedTaskListOptions,
) {
  return usePaginatedTaskList({ ...filters, status }, options);
}

/** One paginated query per phase group (or unassigned when phaseId is null). */
export function usePaginatedPhaseTasks(
  phaseId: string | null,
  filters: StatusColumnFilters,
  options?: PaginatedTaskListOptions,
) {
  return usePaginatedTaskList(
    {
      ...filters,
      ...(phaseId ? { phaseId } : { unassignedPhase: true }),
    },
    options,
  );
}
