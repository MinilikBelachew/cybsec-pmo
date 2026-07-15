"use client";

import { useMemo, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useApproveAllocationMutation,
  useGetAllocationApprovalsQuery,
  useRejectAllocationMutation,
} from "../api/resources.api";
import type { AllocationApprovalRow } from "../types/resources.types";
import type { ColumnDef } from "@tanstack/react-table";

export function StaffingApprovalsPage() {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState<SortingState>([{ id: "requestedAt", desc: true }]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const activeSort = sorting[0];
  const sortBy =
    activeSort?.id === "employeeName" ||
    activeSort?.id === "projectName" ||
    activeSort?.id === "requestedAt"
      ? activeSort.id
      : "requestedAt";

  const { data, isLoading, isFetching, refetch } = useGetAllocationApprovalsQuery({
    search: debouncedSearch.trim() || undefined,
    page: pageIndex + 1,
    limit: pageSize,
    sortBy,
    sortOrder: activeSort?.desc ? "desc" : "asc",
  });

  const [approveAllocation, { isLoading: isApproving }] = useApproveAllocationMutation();
  const [rejectAllocation, { isLoading: isRejecting }] = useRejectAllocationMutation();

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize) || 0;

  const handleApprove = async (row: AllocationApprovalRow) => {
    try {
      const result = await approveAllocation(row.id).unwrap();
      toast.success(
        result.kekaSyncRef
          ? `Approved and synced to Keka (${result.kekaSyncRef})`
          : "Staffing request approved",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not approve staffing request"));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectAllocation({ id, comment: rejectComment.trim() || undefined }).unwrap();
      toast.success("Staffing request rejected");
      setRejectingId(null);
      setRejectComment("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not reject staffing request"));
    }
  };

  const columns = useMemo<ColumnDef<AllocationApprovalRow>[]>(
    () => [
      {
        id: "employeeName",
        accessorKey: "employeeName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <p className="text-sm font-semibold">{item.employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {item.designation} · {item.department}
              </p>
            </div>
          );
        },
      },
      {
        id: "projectName",
        accessorKey: "projectName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.projectName}</p>
            <p className="text-xs text-muted-foreground">{row.original.role}</p>
          </div>
        ),
      },
      {
        id: "allocation",
        header: "Allocation",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-sm">
              <p>
                {item.hours != null ? `${item.hours}h/wk` : `${item.percent}%`}
              </p>
              <p className="text-xs text-rose-600">
                {item.utilizationPercent}% utilized ({item.allocatedHoursAfter}h/wk)
              </p>
            </div>
          );
        },
      },
      {
        id: "requestedAt",
        accessorKey: "requestedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Requested" />,
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{row.original.requestedBy.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(row.original.requestedAt).toLocaleString()}
            </p>
            {row.original.overrideReason ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Reason: {row.original.overrideReason}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          const isRejectOpen = rejectingId === item.id;

          return (
            <div className="flex flex-col items-end gap-2">
              {isRejectOpen ? (
                <div className="w-full max-w-xs space-y-2 rounded-lg border border-border/60 p-2">
                  <Input
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    className="h-8 text-xs"
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectComment("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isRejecting}
                      onClick={() => void handleReject(item.id)}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={isApproving}
                    onClick={() => void handleApprove(item)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setRejectingId(item.id)}
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [rejectingId, rejectComment, isApproving, isRejecting],
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Staffing Approvals"
        description={`${total} pending over-allocation request${total === 1 ? "" : "s"}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh"}
          </Button>
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 shrink-0" />
          PMO Lead and HR review over-capacity staffing requests
        </p>
        <p className="mt-1 text-xs opacity-90">
          Submitters cannot approve their own requests. Approved allocations sync to Keka.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee, project, role..."
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        getRowId={(row) => row.id}
        manual
        hideSearch
        pageCount={pageCount}
        totalRows={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={isLoading}
        emptyMessage="No pending staffing approvals."
        minTableWidth="min-w-[960px]"
      />
    </div>
  );
}
