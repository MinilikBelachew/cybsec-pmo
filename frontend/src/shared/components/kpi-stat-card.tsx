import type { ElementType } from "react";
import { cn } from "@/shared/utils/cn";

export interface KpiCardTheme {
  border: string;
  gradient: string;
  iconColor: string;
  chartColor: string;
}

export const KPI_CARD_THEMES = {
  slate: {
    border: "border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700",
    gradient: "from-slate-500/[0.05] via-transparent to-transparent",
    iconColor: "text-slate-500 dark:text-slate-400",
    chartColor: "text-slate-500/40 dark:text-slate-400/30",
  },
  emerald: {
    border: "border-emerald-500/20 dark:border-emerald-500/10 hover:border-emerald-500/35 dark:hover:border-emerald-500/25",
    gradient: "from-emerald-500/[0.05] via-transparent to-transparent",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    chartColor: "text-emerald-500/40 dark:text-emerald-400/30",
  },
  rose: {
    border: "border-rose-500/20 dark:border-rose-500/10 hover:border-rose-500/35 dark:hover:border-rose-500/25",
    gradient: "from-rose-500/[0.05] via-transparent to-transparent",
    iconColor: "text-rose-500 dark:text-rose-400",
    chartColor: "text-rose-500/40 dark:text-rose-400/30",
  },
  sky: {
    border: "border-sky-500/20 dark:border-sky-500/10 hover:border-sky-500/35 dark:hover:border-sky-500/25",
    gradient: "from-sky-500/[0.05] via-transparent to-transparent",
    iconColor: "text-sky-500 dark:text-sky-400",
    chartColor: "text-sky-500/40 dark:text-sky-400/30",
  },
  primary: {
    border: "border-primary/20 dark:border-primary/10 hover:border-primary/35 dark:hover:border-primary/25",
    gradient: "from-primary/[0.05] via-transparent to-transparent",
    iconColor: "text-primary",
    chartColor: "text-primary/40",
  },
} as const satisfies Record<string, KpiCardTheme>;

function MiniTrendChart({
  value,
  max,
  colorClass,
}: {
  value: number;
  max: number;
  colorClass?: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  const baseHeights = [0.2, 0.55, 0.35, 0.8, 0.65];
  const points = baseHeights.map((h, i) => {
    const x = i * 10;
    const y = 14 - (h * ratio * 10 + 1);
    return { x, y };
  });

  const linePath = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L 40 14 L 0 14 Z`;

  return (
    <svg viewBox="0 0 40 14" className={cn("h-3.5 w-9 shrink-0", colorClass || "text-muted-foreground/40")} aria-hidden>
      <path d={areaPath} fill="currentColor" className="opacity-15" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiStatCard({
  title,
  subtitle,
  value,
  numericValue,
  chartMax,
  icon: Icon,
  theme,
}: {
  title: string;
  subtitle: string;
  value: string | number;
  numericValue: number;
  chartMax: number;
  icon: ElementType;
  theme: KpiCardTheme;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[82px] flex-col rounded-xl border bg-card p-3 px-3.5 text-left bg-gradient-to-l",
        theme.border,
        theme.gradient,
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground/90">{title}</span>
        <Icon className={cn("size-3.5 shrink-0", theme.iconColor)} />
      </div>

      <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{value}</span>

      <div className="mt-auto flex w-full items-end justify-between gap-2 pt-1">
        <span className="truncate text-[10px] text-muted-foreground/75">{subtitle}</span>
        <MiniTrendChart value={numericValue} max={chartMax} colorClass={theme.chartColor} />
      </div>
    </div>
  );
}
