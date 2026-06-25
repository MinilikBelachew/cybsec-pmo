"use client";

import { useEffect, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import { useDebounce } from "@/shared/hooks/use-debounce";

type UseServerTableStateOptions = {
  defaultSorting?: SortingState;
  pageSize?: number;
  debounceMs?: number;
};

export function useServerTableState({
  defaultSorting = [],
  pageSize: initialPageSize = 20,
  debounceMs = 350,
}: UseServerTableStateOptions = {}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);

  const debouncedSearch = useDebounce(search, debounceMs);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, sorting, pageSize]);

  return {
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    search,
    setSearch,
    debouncedSearch,
    sorting,
    setSorting,
  };
}
