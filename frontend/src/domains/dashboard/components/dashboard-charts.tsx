"use client";

import { cn } from "@/shared/utils/cn";
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function MiniTrendChart({ data, colorClass }: { data: number[]; colorClass: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const baseHeights = data.map((v) => (v - min) / range);
  const points = baseHeights.map((h, i) => {
    const x = i * 10;
    const y = 14 - (h * 10 + 1);
    return { x, y };
  });
  const linePath = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L 40 14 L 0 14 Z`;

  return (
    <svg viewBox="0 0 40 14" className={cn("h-3.5 w-9 shrink-0", colorClass)} aria-hidden>
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
export const CARD_THEMES = {
  slate: {
    border: "border-slate-200 dark:border-slate-800/60",
    gradient: "from-slate-500/[0.05] via-transparent to-transparent",
    iconColor: "text-slate-500 dark:text-slate-400",
    chartColor: "text-slate-500/40 dark:text-slate-400/30",
  },
  emerald: {
    border: "border-emerald-500/20 dark:border-emerald-500/10",
    gradient: "from-emerald-500/[0.05] via-transparent to-transparent",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    chartColor: "text-emerald-500/40 dark:text-emerald-400/30",
  },
  rose: {
    border: "border-rose-500/20 dark:border-rose-500/10",
    gradient: "from-rose-500/[0.05] via-transparent to-transparent",
    iconColor: "text-rose-500 dark:text-rose-400",
    chartColor: "text-rose-500/40 dark:text-rose-400/30",
  },
  amber: {
    border: "border-amber-500/20 dark:border-amber-500/10",
    gradient: "from-amber-500/[0.05] via-transparent to-transparent",
    iconColor: "text-amber-500 dark:text-amber-400",
    chartColor: "text-amber-500/40 dark:text-amber-400/30",
  },
  sky: {
    border: "border-sky-500/20 dark:border-sky-500/10",
    gradient: "from-sky-500/[0.05] via-transparent to-transparent",
    iconColor: "text-sky-500 dark:text-sky-400",
    chartColor: "text-sky-500/40 dark:text-sky-400/30",
  },
} as const;
