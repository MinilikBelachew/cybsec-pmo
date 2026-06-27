"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import { ProjectHealthItem } from "../api/dashboard.api";

const STATUS_CONFIG = {
  "on-track": { labelKey: "onTrack", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  "at-risk":  { labelKey: "atRisk",  dot: "bg-amber-400",   text: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  "delayed":  { labelKey: "delayed", dot: "bg-rose-500",    text: "text-rose-700 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-900/20" },
};

export function ProjectHealthTable({ data }: { data: ProjectHealthItem[] }) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const rows = data || [];

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-bold">{t("projectHealthTitle")}</p>
        <span
          onClick={() => router.push("/dashboard/projects")}
          className="text-xs text-[#ff6000] font-semibold cursor-pointer hover:underline"
        >
          {t("allProjects")}
        </span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-none">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-start pb-2 font-semibold text-muted-foreground">{t("project")}</th>
              <th className="text-start pb-2 font-semibold text-muted-foreground">{t("status")}</th>
              <th className="text-end pb-2 font-semibold text-muted-foreground">{t("progress")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((p) => {
              const s = STATUS_CONFIG[p.status] || STATUS_CONFIG["on-track"];
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/dashboard/projects?projectId=${p.id}`)}
                  className="group hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 pe-3">
                    <p className="font-semibold text-foreground leading-tight truncate max-w-[130px]">{p.name}</p>
                    <p className="text-muted-foreground/70 text-[10px] mt-0.5">{p.pm}</p>
                  </td>
                  <td className="py-2.5 pe-3">
                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold", s.bg, s.text)}>
                      <span className={cn("size-1.5 rounded-full", s.dot)} />
                      {t(s.labelKey)}
                    </span>
                  </td>
                  <td className="py-2.5 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full", s.dot)} style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="font-bold text-foreground w-7 text-end">{p.progress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted-foreground">No projects available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
