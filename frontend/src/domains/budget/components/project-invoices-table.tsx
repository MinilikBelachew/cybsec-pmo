"use client";

import Link from "next/link";
import { cn } from "@/shared/utils/cn";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import type {
  InvoicePaymentStatus,
  ProjectInvoice,
} from "@/domains/budget/types/budget.types";

function money(amount: string | null | undefined, currency: string) {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return formatProjectBudget(n, currency);
}

function paymentTone(status: InvoicePaymentStatus) {
  if (status === "paid")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "overdue")
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  if (status === "partial")
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "unpaid")
    return "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

function paymentLabel(status: InvoicePaymentStatus) {
  if (status === "paid") return "Paid";
  if (status === "unpaid") return "Unpaid";
  if (status === "overdue") return "Overdue";
  if (status === "partial") return "Partial";
  return "Other";
}

type ProjectInvoicesTableProps = {
  invoices: ProjectInvoice[];
  isLoading?: boolean;
  emptyMessage?: string;
  showProject?: boolean;
  compact?: boolean;
};

export function ProjectInvoicesTable({
  invoices,
  isLoading,
  emptyMessage = "No invoices linked yet. Sync from Zoho Books and link to this project.",
  showProject = false,
  compact = false,
}: ProjectInvoicesTableProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading invoices…</p>;
  }

  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full text-sm", compact && "text-xs")}>
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Invoice #</th>
            {showProject ? (
              <th className="px-3 py-2 font-semibold">Project</th>
            ) : null}
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">Due</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Collected</th>
            <th className="px-3 py-2 font-semibold">Milestone</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((row) => (
            <tr key={row.id} className="border-t border-border/60 align-top">
              <td className="px-3 py-2">
                <p className="font-medium">{row.invoiceNumber}</p>
                {row.customerName ? (
                  <p className="text-[11px] text-muted-foreground">
                    {row.customerName}
                  </p>
                ) : null}
              </td>
              {showProject ? (
                <td className="px-3 py-2">
                  {row.projectId ? (
                    <Link
                      href={`/dashboard/projects/${row.projectId}?view=financials`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {row.projectName ?? "Project"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unlinked</span>
                  )}
                </td>
              ) : null}
              <td className="px-3 py-2 whitespace-nowrap">
                {money(row.amount, row.currency)}
                {row.balance != null ? (
                  <p className="text-[11px] text-muted-foreground">
                    Bal {money(row.balance, row.currency)}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{row.dueDate}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize",
                    paymentTone(row.paymentStatus),
                  )}
                >
                  {paymentLabel(row.paymentStatus)}
                </span>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {row.status}
                </p>
              </td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {row.collectionDate ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">
                {row.milestoneTitle ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
