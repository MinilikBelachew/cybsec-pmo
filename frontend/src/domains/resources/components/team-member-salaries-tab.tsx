"use client";

import { Loader2, Wallet } from "lucide-react";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import { cn } from "@/shared/utils/cn";
import { useGetEmployeeSalariesQuery } from "../api/resources.api";
import type { EmployeeSalaryRow } from "../types/resources.types";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

function ratePerHour(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function SalaryCard({ row }: { row: EmployeeSalaryRow }) {
  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5",
        row.isCurrent
          ? "border-primary/40 shadow-sm"
          : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Effective from
          </p>
          <p className="mt-0.5 text-base font-semibold">{formatDate(row.effectiveFrom)}</p>
          {row.remunerationLabel ? (
            <p className="mt-1 text-sm text-muted-foreground">{row.remunerationLabel}</p>
          ) : null}
        </div>
        {row.isCurrent ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            Current
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">CTC</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {money(row.ctc, row.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gross</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {money(row.gross, row.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Net pay</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {money(row.netPay, row.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rate / hour</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {ratePerHour(row.ratePerHour, row.currency)}
          </p>
        </div>
      </div>
    </article>
  );
}

export function TeamMemberSalariesTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useGetEmployeeSalariesQuery(employeeId);
  const rows = data?.rows ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading salaries…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        Unable to load salary records. You may not have rate visibility permission.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
        <Wallet className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No salaries synced</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Salary records appear here after a successful Keka payroll sync for this employee.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Employee salaries</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Synced from Keka. Rate per hour is derived via the PMO cost formula.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <SalaryCard key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
