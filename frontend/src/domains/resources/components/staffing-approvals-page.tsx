"use client";

import { useCallback, useMemo, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import { CheckCircle2, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { TASKS_POLLING_INTERVAL_MS } from "@/domains/projects/constants/tasks-polling";
import {
  useApproveAllocationMutation,
  useGetAllocationApprovalsQuery,
  useRejectAllocationMutation,
} from "../api/resources.api";
import type { AllocationApprovalRow } from "../types/resources.types";
import type { ColumnDef } from "@tanstack/react-table";

type PendingAction = {
  id: string;
  type: "approve" | "reject";
};

export function StaffingApprovalsPage() {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState<SortingState>([{ id: "requestedAt", desc: true }]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const activeSort = sorting[0];
  const sortBy =
    activeSort?.id === "employeeName" ||
    activeSort?.id === "projectName" ||
    activeSort?.id === "requestedAt"
      ? activeSort.id
      : "requestedAt";

  const { data, isLoading, refetch } = useGetAllocationApprovalsQuery(
    {
      search: debouncedSearch.trim() || undefined,
      page: pageIndex + 1,
      limit: pageSize,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    },
    { pollingInterval: TASKS_POLLING_INTERVAL_MS },
  );

  const [approveAllocation] = useApproveAllocationMutation();
  const [rejectAllocation] = useRejectAllocationMutation();

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize) || 0;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleApprove = useCallback(
    async (row: AllocationApprovalRow) => {
      setPendingAction({ id: row.id, type: "approve" });
      try {
        const result = await approveAllocation(row.id).unwrap();
        toast.success(
          result.kekaSyncRef
            ? `Approved and synced to Keka (${result.kekaSyncRef})`
            : "Staffing request approved",
        );
        await refetch();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Could not approve staffing request"));
      } finally {
        setPendingAction(null);
      }
    },
    [approveAllocation, refetch],
  );

  const handleReject = useCallback(
    async (id: string, comment: string) => {
      setPendingAction({ id, type: "reject" });
      try {
        await rejectAllocation({ id, comment: comment.trim() || undefined }).unwrap();
        toast.success("Staffing request rejected");
        await refetch();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Could not reject staffing request"));
        throw error;
      } finally {
        setPendingAction(null);
      }
    },
    [rejectAllocation, refetch],
  );

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
          const isApproving =
            pendingAction?.id === item.id && pendingAction.type === "approve";
          const isRejecting =
            pendingAction?.id === item.id && pendingAction.type === "reject";
          return (
            <AllocationApprovalActions
              item={item}
              isApproving={isApproving}
              isRejecting={isRejecting}
              isBusy={pendingAction?.id === item.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          );
        },
      },
    ],
    [handleApprove, handleReject, pendingAction],
  );

  return (
    <div className="space-y-6 pb-10" data-testid="staffing-approvals">
      <PageHeader
        title="Staffing Approvals"
        description={`${total} pending over-allocation request${total === 1 ? "" : "s"}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        }
      />
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

function AllocationApprovalActions({
  item,
  isApproving,
  isRejecting,
  isBusy,
  onApprove,
  onReject,
}: {
  item: AllocationApprovalRow;
  isApproving: boolean;
  isRejecting: boolean;
  isBusy: boolean;
  onApprove: (row: AllocationApprovalRow) => Promise<void>;
  onReject: (id: string, comment: string) => Promise<void>;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const closeReject = () => {
    if (isRejecting) return;
    setRejectOpen(false);
    setRejectComment("");
  };

  if (rejectOpen) {
    return (
      <div className="flex w-full max-w-xs flex-col items-end gap-2">
        <div className="w-full space-y-2 rounded-lg border border-border/60 p-2">
          <Input
            value={rejectComment}
            onChange={(event) => setRejectComment(event.target.value)}
            placeholder="Rejection reason (optional)"
            className="h-8 text-xs"
            autoFocus
            disabled={isRejecting}
          />
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isRejecting}
              onClick={closeReject}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1"
              disabled={isRejecting}
              onClick={() => {
                void onReject(item.id, rejectComment)
                  .then(() => {
                    setRejectOpen(false);
                    setRejectComment("");
                  })
                  .catch(() => undefined);
              }}
            >
              {isRejecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Confirm reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        size="sm"
        className="gap-1"
        disabled={isBusy}
        onClick={() => void onApprove(item)}
        data-testid="staffing-approve"
      >
        {isApproving ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1"
        disabled={isBusy}
        onClick={() => setRejectOpen(true)}
        data-testid="staffing-reject"
      >
        <X className="size-3.5" />
        Reject
      </Button>
    </div>
  );
}
