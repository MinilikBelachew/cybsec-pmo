"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import { ResourceUtilizationResponse, TeamMemberUtilization } from "../api/dashboard.api";

export function ResourceUtilization({ data }: { data: ResourceUtilizationResponse | undefined }) {
  const t = useTranslations("Dashboard");

  const team = data?.team || [];
  const deptData = data?.departments || [];

  const over  = team.filter((x) => x.status === "over").length;
  const under = team.filter((x) => x.status === "under").length;
  const ok    = team.filter((x) => x.status === "ok").length;

  const STATUS_CONFIG = {
    over:  { labelKey: "overStatus",  bar: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-900/20" },
    ok:    { labelKey: "okStatus",    bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    under: { labelKey: "underStatus", bar: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  };

  const maxTotal = Math.max(...deptData.map((d: any) => d.total), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {[
          { labelKey: "overallocatedLabel", count: over,  color: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400" },
          { labelKey: "optimal",       count: ok,    color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" },
          { labelKey: "underutilizedLabel", count: under, color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400" },
        ].map((chip) => (
          <div key={chip.labelKey} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold", chip.color)}>
            <span className="text-xl font-bold">{chip.count}</span>
            <span className="text-xs font-normal opacity-80">{t(chip.labelKey)}</span>
          </div>
        ))}
        <div className="ms-auto text-xs text-muted-foreground whitespace-nowrap">
          {t("avgUtilization")}: <span className="font-bold text-foreground">
            {team.length > 0 ? Math.round(team.reduce((s: number, x: any) => s + x.util, 0) / team.length) : 0}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-3 h-full flex flex-col overflow-hidden">
          <p className="text-sm font-bold shrink-0">{t("teamUtilization")}</p>
          <div className="flex-1 overflow-auto scrollbar-none">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-start pb-2 font-semibold text-muted-foreground">{t("member")}</th>
                  <th className="text-start pb-2 font-semibold text-muted-foreground">{t("dept")}</th>
                  <th className="text-end pb-2 font-semibold text-muted-foreground">{t("utilization")}</th>
                  <th className="text-end pb-2 font-semibold text-muted-foreground">{t("billable")}</th>
                  <th className="text-end pb-2 font-semibold text-muted-foreground">{t("projects")}</th>
                  <th className="text-end pb-2 font-semibold text-muted-foreground">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {team.map((member: TeamMemberUtilization) => {
                  const s = STATUS_CONFIG[member.status] || STATUS_CONFIG.ok;
                  return (
                    <tr key={member.name} className="hover:bg-muted/30 transition-colors cursor-default">
                      <td className="py-2.5 pe-3">
                        <p className="font-semibold text-foreground">{member.name}</p>
                        <p className="text-[10px] text-muted-foreground/70">{member.role}</p>
                      </td>
                      <td className="py-2.5 pe-3 text-muted-foreground">{member.dept}</td>
                      <td className="py-2.5 pe-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", s.bar)}
                              style={{ width: `${member.util}%` }}
                            />
                          </div>
                          <span className={cn("font-bold w-7 text-end", s.text)}>{member.util}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-end font-semibold text-foreground">{member.billable}%</td>
                      <td className="py-2.5 text-end text-muted-foreground">{member.projects}</td>
                      <td className="py-2.5 text-end">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", s.bg, s.text)}>
                          {t(member.status === "over" ? "overallocated" : member.status === "under" ? "underutilized" : "optimal")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-3 h-full flex flex-col">
          <div className="shrink-0">
            <p className="text-sm font-bold">{t("hoursByDept")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("hoursByDeptDesc")}</p>
          </div>

          <div className="flex-1 space-y-4 overflow-auto scrollbar-none">
            {deptData.map((d: any) => (
              <div key={d.dept} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{d.dept}</span>
                  <span className="text-muted-foreground">{t("totalHours", { count: d.total })}</span>
                </div>
                <div className="flex h-5 rounded-lg overflow-hidden bg-muted gap-px">
                  <div
                    className="bg-primary flex items-center justify-center transition-all duration-500 opacity-80"
                    style={{ width: `${(d.billable / maxTotal) * 100}%` }}
                  >
                    {d.billable > 20 && (
                      <span className="text-[9px] font-bold text-primary-foreground">{d.billable}h</span>
                    )}
                  </div>
                  <div
                    className="bg-muted-foreground/20 flex items-center justify-center transition-all duration-500"
                    style={{ width: `${(d.nonBillable / maxTotal) * 100}%` }}
                  >
                    {d.nonBillable > 20 && (
                      <span className="text-[9px] font-semibold text-muted-foreground">{d.nonBillable}h</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {t("billableLegend", { pct: Math.round((d.billable / d.total) * 100) })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    {t("nonBillableLegend", { pct: Math.round((d.nonBillable / d.total) * 100) })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40 shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground">{t("totalBillable")}</p>
              <p className="text-base font-bold mt-0.5">
                {deptData.reduce((s: number, d: any) => s + d.billable, 0)}h
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t("totalNonBillable")}</p>
              <p className="text-base font-bold mt-0.5">
                {deptData.reduce((s: number, d: any) => s + d.nonBillable, 0)}h
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
