"use client";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { TrendingUp } from "lucide-react";

const LABELS: Record<string, string> = {
  totalBudget: "Total Budget",
  spentToDate: "Spent to Date",
  remaining: "Remaining",
  forecastEoy: "Forecast EOY",
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

export function BurnRateChart({ data, showBudget }: { data: any; showBudget: boolean }) {


  const planned = data?.planned || [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const actual = data?.actual || [8, 18, 25, 38, 45, 52, 60, 72, null, null, null, null];
  const summary = data?.summary || { totalBudget: "$0.0M", spentToDate: "$0.0M", remaining: "$0.0M", forecastEoy: "$0.0M" };

  const maxVal = Math.max(...planned, ...actual.filter((v: number | null): v is number => v !== null), 100);
  const currentMonthIdx = actual.filter((v: number | null) => v !== null).length - 1;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const numDots = 10;

  const renderDottedBar = (val: number, isActual: boolean, isCurrent: boolean) => {
    const filledCount = Math.round((val / maxVal) * numDots);
    return (
      <div className="flex flex-col gap-0.5 items-center justify-end h-32 w-4">
        {Array.from({ length: numDots }).map((_, idx) => {
          const dotIdx = numDots - 1 - idx;
          const isFilled = dotIdx < filledCount;
          return (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                isFilled
                  ? isCurrent
                    ? "bg-[#ff6000]"
                    : isActual
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  : "bg-muted/10 border border-border/20"
              )}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Budget Burn Rate</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" /> Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#ff6000]" /> Current month
            </span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {showBudget ? `$${(actual[currentMonthIdx] || 0).toLocaleString()}.00` : "••••••"}
          </p>
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5">
            <TrendingUp className="size-2.5" /> +8.0%
          </Badge>
          <span className="text-[10px] text-muted-foreground">vs last month</span>
        </div>
      </div>

      <div className="flex items-end justify-between px-2 pt-6 border-b border-border/30 pb-2">
        {months.map((m, idx) => {
          const isCurrent = idx === currentMonthIdx;
          const planVal = planned[idx] || 0;
          const actVal = actual[idx];
          const hasActual = actVal !== null;

          return (
            <div key={m} className="flex flex-col items-center gap-2 group relative">
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-popover text-popover-foreground border border-border text-[9px] rounded p-1.5 shadow-md z-30 pointer-events-none w-24">
                <p className="font-bold">{LABELS[m] || m}, 2026</p>
                <p>Plan: ${planVal}k</p>
                {hasActual && <p className="text-primary font-bold">Act: ${actVal}k</p>}
              </div>
              {renderDottedBar(hasActual ? actVal : planVal, hasActual, isCurrent)}
              <span className={cn("text-[9px] font-semibold", isCurrent ? "text-[#ff6000]" : "text-muted-foreground")}>
                {m}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 pt-2 text-xs">
        {[
          { key: "totalBudget",  value: summary.totalBudget },
          { key: "spentToDate",  value: summary.spentToDate },
          { key: "remaining",    value: summary.remaining },
          { key: "forecastEoy",  value: summary.forecastEoy },
        ].map((s) => (
          <div key={s.key}>
            <p className="text-[10px] text-muted-foreground">{LABELS[s.key] || s.key}</p>
            <p className="text-xs font-bold mt-0.5 text-foreground">
              {showBudget ? s.value : "••••"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
