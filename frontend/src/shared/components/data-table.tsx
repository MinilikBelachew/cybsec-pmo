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
  ChevronLeft,
  ChevronRight,
  Columns3,
  ListChecks,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("Table");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [clientPageSize, setClientPageSize] = React.useState(pageSize);

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
    state: {
      sorting: activeSorting,
      columnFilters,
      columnVisibility,
      rowSelection,
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

  return (
    <div className={cn("w-full space-y-3", className)}>
      {(filters || showSearch || bulkSelect || hideableColumns.length > 0) && (
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

              {hideableColumns.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-border/60 bg-white shadow-none dark:bg-card"
                      />
                    }
                  >
                    <Columns3 className="size-4" />
                    {t("columns")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {t("toggleColumns")}
                      </DropdownMenuLabel>
                      {hideableColumns.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      ))}
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
