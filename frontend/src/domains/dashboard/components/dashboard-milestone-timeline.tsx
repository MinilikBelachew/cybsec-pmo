"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import { MilestoneItem } from "../api/dashboard.api";

const STATUS_CONFIG = {
  completed:  { dot: "bg-foreground",  bar: "bg-foreground/20",  text: "text-muted-foreground" },
  "on-track": { dot: "bg-emerald-500", bar: "bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  "at-risk":  { dot: "bg-amber-400",   bar: "bg-amber-400/20",   text: "text-amber-600 dark:text-amber-400" },
  delayed:    { dot: "bg-rose-500",    bar: "bg-rose-500/20",    text: "text-rose-600 dark:text-rose-400" },
};

export function MilestoneTimeline({ data }: { data: MilestoneItem[] }) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const list = data || [];

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-bold">{t("milestoneRoadmap")}</p>
        <span className="text-xs text-muted-foreground">{t("next60Days")}</span>
      </div>

      <div className="relative flex-1 overflow-auto scrollbar-none min-h-[160px]">
        <div className="absolute start-[7px] top-2 bottom-2 w-px bg-border/60" />
        <div className="space-y-0">
          {list.map((m, i) => {
            const s = STATUS_CONFIG[m.status] || STATUS_CONFIG["on-track"];
            return (
              <div
                key={i}
                onClick={() => router.push("/dashboard/projects")}
                className="flex items-start gap-3 group cursor-pointer py-2 hover:bg-muted/30 rounded-lg px-1 transition-colors"
              >
                <div className={cn("size-3.5 rounded-full border-2 border-background shrink-0 mt-0.5 z-10", s.dot)} />
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.project}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{m.date}</span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", s.bar, s.text)}>
                      {m.status === "completed" ? t("doneLabel") : t("daysLabel", { count: m.daysLeft ?? 0 })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-10">No upcoming milestones.</p>
          )}
        </div>
      </div>
    </div>
  );
}
