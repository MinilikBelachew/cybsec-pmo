"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import { Activity, Clock, TrendingUp, FileText, Users } from "lucide-react";
import { CARD_THEMES, MiniTrendChart } from "./dashboard-charts";

export function KpiRow({ variant, stats }: { variant: "portfolio" | "execution" | "people"; stats: any }) {
  const t = useTranslations("Dashboard");

  const pStats = stats?.projects || { total: 0, active: 0, atRisk: 0, delayed: 0, completed: 0, totalValue: 0, totalSpent: 0, remainingBudget: 0 };
  const tStats = stats?.tasks || { total: 0, done: 0, open: 0, overdue: 0, completionRate: 0 };
  const rStats = stats?.risks || { activeCount: 0 };
  const resStats = stats?.resources || { total: 0 };

  const getKPIs = () => {
    switch (variant) {
      case "portfolio":
        return [
          { id: "p1", labelKey: "projectProgress",    value: `${tStats.completionRate}%`, subKey: "tasksMilestones",  spark: [52,55,58,60,63,65,tStats.completionRate],   icon: Activity,   theme: CARD_THEMES.slate },
          { id: "p2", labelKey: "onTimeDelivery",     value: `${100 - Math.round((pStats.delayed / (pStats.total || 1)) * 100)}%`, subKey: "plannedTimeline", spark: [80,82,85,86,88,90,100 - Math.round((pStats.delayed / (pStats.total || 1)) * 100)], icon: Clock, theme: CARD_THEMES.amber },
          { id: "p3", labelKey: "budgetAdherence",    value: pStats.totalValue > 0 ? `${Math.round((pStats.totalSpent / pStats.totalValue) * 100)}%` : "0%", subKey: "plannedVsActual", spark: [85,87,88,89,90,91,pStats.totalValue > 0 ? Math.round((pStats.totalSpent / pStats.totalValue) * 100) : 0], icon: TrendingUp, theme: CARD_THEMES.emerald },
          { id: "p4", labelKey: "scopeChanges",       value: `${pStats.atRisk}`,   subKey: "activeChangeRequests", spark: [6,5,4,4,3,3,pStats.atRisk],       icon: FileText, theme: CARD_THEMES.rose },
          { id: "p5", labelKey: "avgResolutionTime",  value: "2.8d", subKey: "issuesRisks", spark: [5,4.8,4.5,4.2,3.8,3.5,2.8], icon: Users, theme: CARD_THEMES.sky },
        ];
      case "execution":
        return [
          { id: "e1", labelKey: "taskCompletionRate", value: `${tStats.completionRate}%`, subKey: "onSchedule",   spark: [70,72,74,76,78,80,tStats.completionRate], icon: Activity, theme: CARD_THEMES.slate },
          { id: "e2", labelKey: "openTasks",          value: `${tStats.open}`, subKey: "acrossProjects", spark: [155,150,148,145,143,142,tStats.open], icon: FileText, theme: CARD_THEMES.emerald },
          { id: "e3", labelKey: "overdueTasks",       value: `${tStats.overdue}`, subKey: "needAttention", spark: [35,32,30,28,26,24,tStats.overdue], icon: Clock, theme: CARD_THEMES.rose },
          { id: "e4", labelKey: "activeRisks",        value: `${rStats.activeCount}`, subKey: "highSeverity", spark: [10,9,9,8,7,7,rStats.activeCount], icon: Users, theme: CARD_THEMES.amber },
          { id: "e5", labelKey: "issueResTime",       value: "2.1d", subKey: "avgCloseTime", spark: [3.2,3.0,2.8,2.6,2.4,2.2,2.1], icon: Activity, theme: CARD_THEMES.sky },
        ];
      case "people":
        return [
          { id: "h1", labelKey: "resourceUtilization", value: "76%", subKey: "avgAcrossTeam",   spark: [70,72,73,75,76,77,76], icon: Users, theme: CARD_THEMES.slate },
          { id: "h2", labelKey: "overallocated",        value: "2",   subKey: "teamMembers",     spark: [5,4,4,3,3,2,2], icon: Users, theme: CARD_THEMES.rose },
          { id: "h3", labelKey: "underutilized",        value: "4",   subKey: "availableCapacity", spark: [8,7,7,6,5,4,4], icon: Users, theme: CARD_THEMES.amber },
          { id: "h4", labelKey: "pendingTimesheets",   value: "5",   subKey: "overdue",          spark: [12,11,9,8,7,6,5], icon: Clock, theme: CARD_THEMES.sky },
          { id: "h5", labelKey: "billableHours",       value: `${resStats.total * 32}h`, subKey: "thisMonth", spark: [1200,1250,1300,1350,1400,1450,resStats.total * 32], icon: TrendingUp, theme: CARD_THEMES.emerald },
        ];
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {getKPIs().map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.id}
            className="relative flex min-h-[82px] flex-col rounded-xl border border-border/40 bg-card/70 backdrop-blur-md p-3 px-3.5 text-left cursor-default"
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <span className="text-[11px] font-medium text-muted-foreground/90 truncate">{t(kpi.labelKey)}</span>
              <Icon className={cn("size-3.5 shrink-0", kpi.theme.iconColor)} />
            </div>

            <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{kpi.value}</span>

            <div className="mt-auto flex items-end justify-between gap-2 pt-1 w-full">
              <span className="text-[10px] text-muted-foreground/75 truncate">{t(kpi.subKey)}</span>
              <MiniTrendChart data={kpi.spark} colorClass={kpi.theme.chartColor} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
