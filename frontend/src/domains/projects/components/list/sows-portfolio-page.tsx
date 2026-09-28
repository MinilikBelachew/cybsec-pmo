"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@/i18n/routing";
import { DataTable } from "@/shared/components/data-table";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/components/spinner";
import { useModulePermissions } from "@/domains/auth";
import { useListSowsQuery } from "../../api/sows.api";
import type { SowDocument } from "../../types/sow.types";

function statusBadgeClass(status: string) {
  if (status === "Approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }
  return "border-amber-300 bg-amber-50 text-amber-800";
}

export function SowsPortfolioPage() {
  const { canViewSow } = useModulePermissions();
  const { data = [], isLoading, isError } = useListSowsQuery(undefined, {
    skip: !canViewSow,
  });

  const columns = useMemo<ColumnDef<SowDocument>[]>(
    () => [
      {
        accessorKey: "projectName",
        header: "Project",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/projects/${row.original.projectId}?view=sow`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.projectName ?? "Untitled project"}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) =>
          row.original.customerName ??
          row.original.snapshot.customerName ??
          "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={statusBadgeClass(row.original.status)}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => `v${row.original.version}`,
      },
      {
        id: "crm",
        header: "CRM write-back",
        cell: ({ row }) => {
          if (row.original.crmWrittenBackAt) {
            return (
              <span className="text-emerald-700">
                Synced{" "}
                {new Date(row.original.crmWrittenBackAt).toLocaleDateString()}
              </span>
            );
          }
          if (row.original.status === "Approved") {
            return <span className="text-amber-700">Pending</span>;
          }
          return "—";
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    [],
  );

  if (!canViewSow) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view Statements of Work.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statements of Work"
        description="Portfolio view of project SOWs. Open a row to edit, approve, or check Zoho write-back."
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load SOWs.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKey="projectName"
          emptyMessage="No SOWs yet. Create one from a project workspace SOW tab."
        />
      )}
    </div>
  );
}
