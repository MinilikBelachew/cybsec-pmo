"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  EyeOff,
  GripVertical,
  ListChecks,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { cn } from "@/shared/utils/cn";

export type DataTableBulkSelectProps = {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  actions?: React.ReactNode;
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  getRowId?: (row: TData) => string;
  searchKey?: string;
  searchPlaceholder?: string;
  hideSearch?: boolean;
  manual?: boolean;
  pageCount?: number;
  totalRows?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  isLoading?: boolean;
  filters?: React.ReactNode;
  bulkSelect?: DataTableBulkSelectProps;
  onSelectionChange?: (rows: TData[]) => void;
  emptyMessage?: string;
  tableClassName?: string;
  minTableWidth?: string;
  onRowClick?: (row: TData) => void;
  enableColumnReorder?: boolean;
  columnOrderStorageKey?: string;
};

function stickyCellClass(
  sticky: "left" | "right" | undefined,
  isHeader?: boolean,
  selected?: boolean,
) {
  if (!sticky) return undefined;

  const bg = isHeader
    ? "bg-muted/50 dark:bg-muted/30"
    : "bg-white dark:bg-card";

  return cn(
    "sticky z-20",
    bg,
    sticky === "left" ? "left-0" : "right-0",
    selected && !isHeader && "bg-primary/5 dark:bg-primary/10",
  );
}

const headerRowClass = "border-border/50 bg-muted/50 hover:bg-muted/50 dark:bg-muted/30";
const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

function getColumnIds<TData, TValue>(cols: ColumnDef<TData, TValue>[]) {
  return cols
    .map((col) => {
      if (col.id) return col.id;
      if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
      return "";
    })
    .filter(Boolean);
}

function mergeColumnOrder(current: string[], defaults: string[]) {
  const valid = current.filter((id) => defaults.includes(id));
  const missing = defaults.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

function readStoredColumnVisibility(storageKey: string): VisibilityState {
  if (typeof window === "undefined") return {};

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return saved as VisibilityState;
  } catch {
    return {};
  }
}

function readStoredColumnOrder(storageKey: string, defaults: string[]) {
  if (typeof window === "undefined") return defaults;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!Array.isArray(saved) || saved.length === 0) return defaults;
    return mergeColumnOrder(saved.filter((id): id is string => typeof id === "string"), defaults);
  } catch {
    return defaults;
  }
}

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  getRowId,
  searchKey,
  searchPlaceholder,
  hideSearch = false,
  manual = false,
  pageCount = 0,
  totalRows = 0,
  pageIndex = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [...PAGE_SIZE_OPTIONS],
  sorting: controlledSorting,
  onSortingChange,
  searchValue = "",
  onSearchChange,
  isLoading = false,
  filters,
  bulkSelect,
  onSelectionChange,
  emptyMessage,
  tableClassName,
  minTableWidth = "min-w-[960px]",
  onRowClick,
  enableColumnReorder = false,
  columnOrderStorageKey,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("Table");
  const visibilityStorageKey = columnOrderStorageKey
    ? `${columnOrderStorageKey}-visibility`
    : undefined;
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    if (!visibilityStorageKey) return {};
    return readStoredColumnVisibility(visibilityStorageKey);
  });
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [clientPageSize, setClientPageSize] = React.useState(pageSize);
  const [draggingColumnId, setDraggingColumnId] = React.useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = React.useState<string | null>(null);

  const defaultColumnOrder = React.useMemo(() => getColumnIds(columns), [columns]);
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => {
    if (!enableColumnReorder) return defaultColumnOrder;
    if (columnOrderStorageKey) {
      return readStoredColumnOrder(columnOrderStorageKey, defaultColumnOrder);
    }
    return defaultColumnOrder;
  });

  React.useEffect(() => {
    if (!enableColumnReorder) return;
    setColumnOrder((prev) => {
      const next = mergeColumnOrder(prev, defaultColumnOrder);
      return next.join(",") === prev.join(",") ? prev : next;
    });
  }, [defaultColumnOrder, enableColumnReorder]);

  React.useEffect(() => {
    if (!enableColumnReorder || !columnOrderStorageKey) return;
    localStorage.setItem(columnOrderStorageKey, JSON.stringify(columnOrder));
  }, [columnOrder, columnOrderStorageKey, enableColumnReorder]);

  React.useEffect(() => {
    if (!visibilityStorageKey) return;
    localStorage.setItem(visibilityStorageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, visibilityStorageKey]);

  const resolvedPageSize = manual ? pageSize : clientPageSize;

  const bulkActive = bulkSelect?.active ?? false;
  const showSearch = !hideSearch && (Boolean(searchKey) || manual);
  const activeSorting = manual ? (controlledSorting ?? []) : sorting;
  const selectedCount = Object.keys(rowSelection).length;

  React.useEffect(() => {
    if (!bulkActive) {
      setRowSelection({});
    }
  }, [bulkActive]);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next =
        typeof updater === "function" ? updater(activeSorting) : updater;

      if (manual) {
        onSortingChange?.(next);
        return;
      }

      setSorting(next);
    },
    [activeSorting, manual, onSortingChange],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    enableRowSelection: bulkActive,
    pageCount: manual ? pageCount : undefined,
    manualPagination: manual,
    manualSorting: manual,
    manualFiltering: manual,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    ...(manual
      ? {}
      : {
          getPaginationRowModel: getPaginationRowModel(),
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          initialState: {
            pagination: {
              pageIndex,
              pageSize,
            },
          },
        }),
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: enableColumnReorder ? setColumnOrder : undefined,
    state: {
      sorting: activeSorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(enableColumnReorder ? { columnOrder } : {}),
      ...(manual ? { pagination: { pageIndex, pageSize: resolvedPageSize } } : {}),
    },
  });

  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const selectionSignatureRef = React.useRef("");

  React.useEffect(() => {
    const callback = onSelectionChangeRef.current;
    if (!callback) return;

    const selectedIds = Object.keys(rowSelection).sort().join(",");
    if (selectedIds === selectionSignatureRef.current) return;
    selectionSignatureRef.current = selectedIds;

    const selectedIdSet = new Set(
      selectedIds ? selectedIds.split(",") : [],
    );
    const selected = data.filter((row) => {
      const id = getRowId ? getRowId(row) : "";
      return id && selectedIdSet.has(id);
    });

    callback(selected);
  }, [rowSelection, data, getRowId]);

  const canPreviousPage = manual ? pageIndex > 0 : table.getCanPreviousPage();
  const canNextPage = manual
    ? pageIndex + 1 < pageCount
    : table.getCanNextPage();

  const resolvedSearchValue = manual
    ? searchValue
    : ((table.getColumn(searchKey!)?.getFilterValue() as string) ?? "");

  const handleSearchChange = (value: string) => {
    if (manual) {
      onSearchChange?.(value);
      return;
    }
    table.getColumn(searchKey!)?.setFilterValue(value);
  };

  const rangeStart = totalRows === 0 ? 0 : pageIndex * resolvedPageSize + 1;
  const rangeEnd = manual
    ? Math.min((pageIndex + 1) * resolvedPageSize, totalRows)
    : table.getRowModel().rows.length;

  const handlePageSizeChange = (value: string | null) => {
    if (!value) return;
    const nextSize = Number(value);
    if (manual) {
      onPageSizeChange?.(nextSize);
      onPageChange?.(0);
      return;
    }

    setClientPageSize(nextSize);
    table.setPageSize(nextSize);
    table.setPageIndex(0);
  };

  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  const showColumnManager = enableColumnReorder || hideableColumns.length > 0;

  const managedColumnIds = React.useMemo(() => {
    const ids = enableColumnReorder ? columnOrder : getColumnIds(columns);
    return ids.filter((id) => {
      const column = table.getColumn(id);
      if (!column) return false;
      if (column.columnDef.meta?.enableColumnReorder === false && !column.getCanHide()) {
        return false;
      }
      return column.getCanHide() || enableColumnReorder;
    });
  }, [columnOrder, columns, enableColumnReorder, table]);

  const handleColumnDragStart = React.useCallback(
    (columnId: string) => (event: React.DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", columnId);
      setDraggingColumnId(columnId);
    },
    [],
  );

  const handleColumnDragOver = React.useCallback(
    (columnId: string) => (event: React.DragEvent) => {
      if (!draggingColumnId || draggingColumnId === columnId) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDropTargetColumnId(columnId);
    },
    [draggingColumnId],
  );

  const reorderColumns = React.useCallback((sourceColumnId: string, targetColumnId: string) => {
    if (!sourceColumnId || sourceColumnId === targetColumnId) return;

    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(sourceColumnId);
      const toIndex = next.indexOf(targetColumnId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceColumnId);
      return next;
    });
  }, []);

  const handleColumnDrop = React.useCallback(
    (targetColumnId: string) => (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceColumnId = event.dataTransfer.getData("text/plain") || draggingColumnId;
      if (!sourceColumnId || sourceColumnId === targetColumnId) {
        setDraggingColumnId(null);
        setDropTargetColumnId(null);
        return;
      }

      reorderColumns(sourceColumnId, targetColumnId);
      setDraggingColumnId(null);
      setDropTargetColumnId(null);
    },
    [draggingColumnId, reorderColumns],
  );

  const handleColumnDragEnd = React.useCallback(() => {
    setDraggingColumnId(null);
    setDropTargetColumnId(null);
  }, []);

  const canReorderColumn = React.useCallback(
    (columnId: string) => {
      if (!enableColumnReorder) return false;
      const column = table.getColumn(columnId);
      if (!column) return false;
      if (column.columnDef.meta?.enableColumnReorder === false) return false;
      if (column.columnDef.meta?.sticky) return false;
      return true;
    },
    [enableColumnReorder, table],
  );

  return (
    <div className={cn("w-full space-y-3", className)}>
      {(filters || showSearch || bulkSelect || showColumnManager) && (
        <div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {filters}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {showSearch && (
                <div className="relative w-full min-w-[200px] sm:w-72 lg:w-80">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder ?? t("search")}
                    value={resolvedSearchValue}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    maxLength={200}
                    className="h-9 border-border/60 bg-white ps-9 pe-8 shadow-none dark:bg-card"
                  />
                  {resolvedSearchValue && (
                    <button
                      type="button"
                      aria-label={t("clearSearch")}
                      onClick={() => handleSearchChange("")}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}

              {bulkSelect && (
                <Button
                  type="button"
                  variant={bulkActive ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 gap-1.5 border-border/60 bg-white shadow-none dark:bg-card"
                  onClick={() => bulkSelect.onActiveChange(!bulkActive)}
                >
                  <ListChecks className="size-4" />
                  {bulkActive ? t("cancelSelect") : t("selectRows")}
                </Button>
              )}

              {bulkActive && selectedCount > 0 && bulkSelect?.actions}

              {showColumnManager && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border/60 bg-white shadow-none dark:bg-card"
                      />
                    }
                  >
                    <Columns3 className="size-4" />
                    {t("columns")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-1.5 text-xs text-muted-foreground">
                        {t("toggleColumns")}
                      </DropdownMenuLabel>
                      {enableColumnReorder && (
                        <p className="px-1.5 pb-1.5 text-[10px] leading-snug text-muted-foreground">
                          {t("manageColumnsHint")}
                        </p>
                      )}
                      <div className="max-h-72 space-y-0.5 overflow-y-auto">
                        {managedColumnIds.map((columnId) => {
                          const column = table.getColumn(columnId);
                          if (!column) return null;

                          const label = column.columnDef.meta?.label ?? column.id;
                          const isVisible = column.getIsVisible();
                          const canReorder = canReorderColumn(columnId);
                          const canHide = column.getCanHide();

                          return (
                            <div
                              key={columnId}
                              onDragOver={
                                canReorder ? handleColumnDragOver(columnId) : undefined
                              }
                              onDrop={canReorder ? handleColumnDrop(columnId) : undefined}
                              className={cn(
                                "flex items-center gap-1 rounded-md px-1 py-0.5",
                                dropTargetColumnId === columnId && "bg-primary/10",
                                draggingColumnId === columnId && "opacity-60",
                              )}
                            >
                              {canReorder ? (
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={handleColumnDragStart(columnId)}
                                  onDragEnd={handleColumnDragEnd}
                                  aria-label={t("reorderColumn")}
                                  className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <GripVertical className="size-3.5" />
                                </button>
                              ) : (
                                <span className="size-4 shrink-0" />
                              )}

                              <button
                                type="button"
                                disabled={!canHide}
                                onClick={() => canHide && column.toggleVisibility()}
                                className={cn(
                                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors",
                                  canHide && "hover:bg-accent",
                                  !isVisible && "text-muted-foreground",
                                )}
                              >
                                <span className="truncate">{label}</span>
                                {canHide && (
                                  isVisible ? (
                                    <Check className="ms-auto size-3.5 shrink-0 text-primary" />
                                  ) : (
                                    <EyeOff className="ms-auto size-3.5 shrink-0 text-muted-foreground" />
                                  )
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {bulkActive && (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedCount > 0
                ? t("rowsSelected", { selected: selectedCount, total: data.length })
                : t("selectRowsHint")}
            </p>
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-t-[10px]">
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="overflow-x-auto">
            <Table className={cn(minTableWidth, "w-full table-fixed", tableClassName)}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className={headerRowClass}>
                    {headerGroup.headers.map((header, headerIndex) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-11 px-4 bg-muted/50 dark:bg-muted/30",
                          headerIndex === 0 && "rounded-tl-[10px]",
                          headerIndex === headerGroup.headers.length - 1 &&
                            "rounded-tr-[10px]",
                          stickyCellClass(header.column.columnDef.meta?.sticky, true),
                          header.column.columnDef.meta?.className,
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={cn(
                        "border-border/40 transition-colors hover:bg-muted/20",
                        row.getIsSelected() && "bg-primary/5 hover:bg-primary/8",
                        onRowClick && "cursor-pointer",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-4 py-3 align-middle whitespace-normal bg-white dark:bg-card",
                            stickyCellClass(
                              cell.column.columnDef.meta?.sticky,
                              false,
                              row.getIsSelected(),
                            ),
                            cell.column.columnDef.meta?.className,
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="h-44 text-center">
                      <p className="text-sm text-muted-foreground">
                        {isLoading ? t("loading") : (emptyMessage ?? t("noResults"))}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("rowsPerPage")}</span>
              <Select
                value={String(resolvedPageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 min-w-[4.5rem] border-border/60 bg-white shadow-none dark:bg-card"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              {manual ? (
                totalRows > 0 ? (
                  t("showingRange", { start: rangeStart, end: rangeEnd, total: totalRows })
                ) : (
                  t("noResults")
                )
              ) : (
                t("rowsSelected", {
                  selected: table.getFilteredSelectedRowModel().rows.length,
                  total: table.getFilteredRowModel().rows.length,
                })
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            {manual && pageCount > 1 && (
              <span className="me-2 text-xs text-muted-foreground">
                {t("pageOf", { page: pageIndex + 1, total: Math.max(pageCount, 1) })}
              </span>
            )}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (manual) onPageChange?.(Math.max(0, pageIndex - 1));
                else table.previousPage();
              }}
              disabled={!canPreviousPage || isLoading}
              className="size-8 border-border/60 bg-white shadow-none dark:bg-card"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">{t("previous")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (manual) onPageChange?.(pageIndex + 1);
                else table.nextPage();
              }}
              disabled={!canNextPage || isLoading}
              className="size-8 border-border/60 bg-white shadow-none dark:bg-card"
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">{t("next")}</span>
            </Button>
          </div>
        </div>
    </div>
  );
}
