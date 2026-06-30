"use client";

import { cn } from "@/shared/utils/cn";

const HEALTH_LABELS: Record<string, string> = {
  onTrack: "On Track",
  atRisk: "At Risk",
  delayed: "Delayed",
};

export function PortfolioStrip({ stats }: { stats: any }) {


  const p = stats?.projects || { active: 0, atRisk: 0, delayed: 0, completed: 0, total: 0 };
  const total = p.total || 1;

  const HEALTH = [
    { id: "onTrack",  count: p.active, pct: Math.round((p.active / total) * 100), color: "bg-emerald-500", text: "text-emerald-500" },
    { id: "atRisk",   count: p.atRisk,  pct: Math.round((p.atRisk / total) * 100), color: "bg-amber-400", text: "text-amber-400" },
    { id: "delayed",  count: p.delayed,  pct: Math.round((p.delayed / total) * 100), color: "bg-rose-500", text: "text-rose-500" },
  ];

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">Portfolio Health</span>
        <span className="text-xs font-semibold text-muted-foreground">{p.total} projects</span>
      </div>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 bg-muted">
        {HEALTH.map((h) => (
          <div
            key={h.id}
            className={cn("h-full transition-all duration-500", h.color)}
            style={{ width: `${h.pct}%` }}
          />
        ))}
      </div>

      {/* Underneath breakdown grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {HEALTH.map((h) => (
          <div key={h.id} className="border-r border-border/30 last:border-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", h.color)} />
              <span className="text-[10px] text-muted-foreground capitalize">{HEALTH_LABELS[h.id] || h.id}</span>
              <span className="text-[10px] font-bold text-muted-foreground ml-auto">{h.pct}%</span>
            </div>
            <p className={cn("text-lg font-bold mt-0.5", h.text)}>
              {h.count} <span className="text-[10px] font-normal text-muted-foreground">projects</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
