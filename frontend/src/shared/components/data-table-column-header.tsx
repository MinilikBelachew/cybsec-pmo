"use client";

import { type Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const labelClass = cn("text-sm font-medium text-muted-foreground", className);

  if (!column.getCanSort()) {
    return <span className={labelClass}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      className={cn(
        "group inline-flex items-center gap-1 rounded-md px-1 py-0.5 -ms-1",
        "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        sorted && "text-foreground",
        className,
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <span className="text-muted-foreground/60 group-hover:text-muted-foreground">
        {sorted === "desc" ? (
          <ChevronDown className="size-4" />
        ) : sorted === "asc" ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronsUpDown className="size-4 opacity-50" />
        )}
      </span>
    </button>
  );
}
