"use client";

import { Receipt } from "lucide-react";
import { useGetProjectInvoicesQuery } from "@/domains/budget";
import { ProjectInvoicesTable } from "@/domains/budget/components/project-invoices-table";
import Link from "next/link";

type ProjectInvoicesPanelProps = {
  projectId: string;
};

export function ProjectInvoicesPanel({ projectId }: ProjectInvoicesPanelProps) {
  const { data = [], isLoading, isError } = useGetProjectInvoicesQuery(projectId);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 space-y-1">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Receipt className="size-4" />
          Invoices &amp; collections
        </h2>
        <p className="text-xs text-muted-foreground">
          Zoho Books invoices linked to this project (number, amount, due,
          paid/unpaid/overdue).{" "}
          <Link
            href="/dashboard/integrations/zoho-books"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Manage links
          </Link>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isError ? (
          <p className="text-sm text-destructive">Unable to load invoices.</p>
        ) : (
          <ProjectInvoicesTable
            invoices={data}
            isLoading={isLoading}
            compact
            emptyMessage="No invoices linked to this project yet."
          />
        )}
      </div>
    </div>
  );
}
