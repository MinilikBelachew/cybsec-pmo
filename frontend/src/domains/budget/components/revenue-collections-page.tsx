"use client";

import { useMemo, useState } from "react";
import { Receipt, TrendingUp } from "lucide-react";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  useGetPortfolioInvoicesQuery,
} from "@/domains/budget";
import { ProjectInvoicesTable } from "@/domains/budget/components/project-invoices-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import type { InvoicePaymentStatus } from "@/domains/budget/types/budget.types";

type Filter = "all" | InvoicePaymentStatus;

export function RevenueCollectionsPage() {
  const { canViewFinancials } = useModulePermissions();
  const { data = [], isLoading, isError } = useGetPortfolioInvoicesQuery(
    { limit: 300, linkedOnly: true },
    { skip: !canViewFinancials },
  );
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return data;
    return data.filter((r) => r.paymentStatus === filter);
  }, [data, filter]);

  const summary = useMemo(() => {
    let billed = 0;
    let overdue = 0;
    let unpaid = 0;
    let paid = 0;
    for (const row of data) {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount)) continue;
      billed += amount;
      if (row.paymentStatus === "overdue") overdue += amount;
      else if (row.paymentStatus === "unpaid" || row.paymentStatus === "partial")
        unpaid += amount;
      else if (row.paymentStatus === "paid") paid += amount;
    }
    return { billed, overdue, unpaid, paid, count: data.length };
  }, [data]);

  if (!canViewFinancials) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        You do not have permission to view revenue and collections.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="size-5" /> Revenue &amp; Collections
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Portfolio view of Zoho Books invoices linked to your projects.
            Open a project Financials tab for budget beside invoices.
          </p>
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter((v as Filter) ?? "all")}
        >
          <SelectTrigger className="w-[160px]" size="sm">
            <SelectValue>
              {filter === "all"
                ? "All statuses"
                : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Linked invoices"
          value={String(summary.count)}
          icon={<Receipt className="size-4" />}
        />
        <SummaryCard
          label="Billed"
          value={formatProjectBudget(summary.billed, "USD")}
        />
        <SummaryCard
          label="Paid"
          value={formatProjectBudget(summary.paid, "USD")}
        />
        <SummaryCard
          label="Overdue"
          value={formatProjectBudget(summary.overdue, "USD")}
          tone="danger"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold">Invoices</h2>
          <p className="text-xs text-muted-foreground">
            Status is normalized to paid / unpaid / overdue (Zoho raw status
            shown under the badge). Link invoices in Integrations → Zoho Books.
          </p>
        </div>
        {isError ? (
          <p className="text-sm text-destructive">Unable to load invoices.</p>
        ) : (
          <ProjectInvoicesTable
            invoices={visible}
            isLoading={isLoading}
            showProject
            emptyMessage="No linked invoices yet. Sync Zoho Books and link invoices to projects."
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p
        className={
          tone === "danger"
            ? "mt-1 text-lg font-semibold text-destructive"
            : "mt-1 text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
