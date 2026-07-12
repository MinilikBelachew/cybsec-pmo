"use client";

import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Clock,
  FileText,
  PieChart,
  Play,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";

type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  live?: boolean;
  tags: string[];
};

const TEMPLATES: ReportTemplate[] = [
  {
    id: "utilization",
    name: "Resource Utilization Report",
    description:
      "Planned, submitted, approved, billable, non-billable and available hours with Keka reconciliation.",
    icon: PieChart,
    href: "/dashboard/reports/utilization",
    live: true,
    tags: ["Utilization", "M2.6", "Keka"],
  },
  {
    id: "executive",
    name: "Executive Summary",
    description: "Portfolio health, budget vs actual, and top risks for leadership.",
    icon: BarChart3,
    tags: ["Executive", "Coming soon"],
  },
  {
    id: "wsr",
    name: "Weekly Status Report (WSR)",
    description: "Week-on-week progress, milestones, risks, and burn rate.",
    icon: Calendar,
    tags: ["WSR", "Coming soon"],
  },
  {
    id: "timesheets",
    name: "Timesheet & Effort Report",
    description: "Hours logged per resource, planned vs actual, overtime trends.",
    icon: Clock,
    tags: ["Timesheets", "Coming soon"],
  },
  {
    id: "budget",
    name: "Budget Adherence Report",
    description: "Planned vs actual costs, burn rate, and variance alerts.",
    icon: Wallet,
    tags: ["Finance", "Coming soon"],
  },
  {
    id: "portfolio",
    name: "Portfolio Dashboard Report",
    description: "Multi-project overview with allocation and critical path analysis.",
    icon: TrendingUp,
    tags: ["Portfolio", "Coming soon"],
  },
];

export function ReportsHubPage() {
  const liveCount = TEMPLATES.filter((template) => template.live).length;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Reports"
        description={`${liveCount} live report · ${TEMPLATES.length - liveCount} planned for Phase 3`}
      />

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">M2.6 Utilisation is live</p>
        <p className="mt-1 text-muted-foreground">
          Start with the Resource Utilization report. Additional report types from the PBO
          reference will ship in Phase 3.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          const card = (
            <div
              className={cn(
                "group flex h-full flex-col rounded-2xl border bg-card transition-all duration-150",
                template.live
                  ? "border-primary/30 hover:border-primary/50 hover:shadow-sm"
                  : "border-border/60 opacity-90",
              )}
            >
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      template.live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  {template.live ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Soon
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold leading-tight">{template.name}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {template.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/40 px-5 py-4">
                {template.live && template.href ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Play className="size-3.5" />
                    Open report
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    Available in a later phase
                  </span>
                )}
              </div>
            </div>
          );

          if (template.live && template.href) {
            return (
              <Link key={template.id} href={template.href} className="block h-full">
                {card}
              </Link>
            );
          }

          return <div key={template.id}>{card}</div>;
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Need a custom report?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled reports, status packs, and analytics dashboards are planned for Phase 3
              (M3.1). The utilization report already uses the Gate 2 formula and six hour
              categories.
            </p>
          </div>
          <FileText className="ms-auto size-5 shrink-0 text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}
