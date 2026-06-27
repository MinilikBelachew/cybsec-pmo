"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/domains/auth";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Compass,
} from "lucide-react";
import {
  useGetDashboardStatsQuery,
  useGetDashboardProjectHealthQuery,
  useGetDashboardMilestonesQuery,
  useGetDashboardResourcesQuery,
  useGetDashboardBurnRateQuery,
  useGetDashboardAuditFeedQuery,
} from "../api/dashboard.api";

// Subcomponents
import { KpiRow } from "./dashboard-kpi-row";
import { BurnRateChart } from "./dashboard-burn-rate";
import { ProjectHealthTable } from "./dashboard-project-health";
import { RiskMatrix } from "./dashboard-risk-matrix";
import { MilestoneTimeline } from "./dashboard-milestone-timeline";
import { AuditFeed } from "./dashboard-audit-feed";
import { ResourceUtilization } from "./dashboard-resource-utilization";
import { PortfolioStrip } from "./dashboard-portfolio-strip";
import { ProjectSimulationPanel } from "./dashboard-simulation-panel";

const TABS = [
  { id: "portfolio", label: "Portfolio Overview" },
  { id: "execution", label: "Execution Health" },
  { id: "people",    label: "People & Resources" },
] as const;

type Tab = typeof TABS[number]["id"];

export function DashboardHome() {
  const { user } = useAuth();
  const t = useTranslations("Dashboard");

  const [tab, setTab] = useState<Tab>("portfolio");
  const [showBudget, setShowBudget] = useState(true);

  // API Queries with refetch bindings
  const { data: stats, refetch: refetchStats } = useGetDashboardStatsQuery();
  const { data: health, refetch: refetchHealth } = useGetDashboardProjectHealthQuery();
  const { data: milestones, refetch: refetchMilestones } = useGetDashboardMilestonesQuery();
  const { data: resources, refetch: refetchResources } = useGetDashboardResourcesQuery();
  const { data: burnRate, refetch: refetchBurnRate } = useGetDashboardBurnRateQuery();
  const { data: auditFeed, refetch: refetchAuditFeed } = useGetDashboardAuditFeedQuery();

  const handleReload = () => {
    refetchStats();
    refetchHealth();
    refetchMilestones();
    refetchResources();
    refetchBurnRate();
    refetchAuditFeed();
  };

  const router = useRouter();

  return (
    <div className="space-y-4 pb-8">
      {/* ── Top navigation bar ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Compass className="size-3.5" />
          <span>Home</span>
          <span>/</span>
          <span className="text-foreground font-semibold">Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock className="size-3" /> Updated just now</span>
          <button
            onClick={handleReload}
            className="flex items-center gap-1 font-semibold text-[#ff6000] hover:underline cursor-pointer"
          >
            <RefreshCw className="size-3" /> {t("reload") || "Reload"}
          </button>
        </div>
      </div>

      {/* ── Single Integrated Header Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background/80 backdrop-blur-md p-4 rounded-xl border border-border/40">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Welcome back, {user?.name || "User"}!</h1>
            <div className="flex gap-1.5">
              {user?.roles?.map((role) => (
                <Badge key={role} variant="secondary" className="capitalize text-[10px] px-1.5 py-0.5 rounded">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">
            {t("executiveView")} · {t("portfolioDashboard")}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/60 border border-border/50 shrink-0">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                tab === tabItem.id
                  ? "bg-card text-foreground border border-border/60 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`${tabItem.id}Tab`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabbed Content Blocks ── */}
      {tab === "portfolio" && (
        <div className="space-y-4">
          {/* Double Column Budget Card & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            {/* Total Balance style Budget Card */}
            <div className="lg:col-span-2 p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 flex flex-col justify-between min-h-[160px]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase">{t("portfolioBudget") || "Total Portfolio Budget"}</p>
                <button
                  onClick={() => setShowBudget((s) => !s)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showBudget ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <p className="text-3xl font-extrabold tracking-tight text-foreground">
                  {showBudget ? `$${Number(stats?.projects.totalValue || 0).toLocaleString()}.00` : "••••••••••"}
                </p>
                <span className="text-xs font-bold text-muted-foreground">USD</span>
              </div>
              <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs">
                <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50 border-violet-100 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5">
                  <TrendingUp className="size-2.5" /> +2.8%
                </Badge>
                <span className="text-muted-foreground">{t("vsLastQuarter") || "vs last quarter"}</span>
              </div>
            </div>

            {/* Currency Breakdown style Status Strip */}
            <div className="lg:col-span-3">
              <PortfolioStrip stats={stats} />
            </div>
          </div>

          <KpiRow variant="portfolio" stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-3 space-y-4">
              <BurnRateChart data={burnRate} showBudget={showBudget} />
              <MilestoneTimeline data={milestones || []} />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <ProjectHealthTable data={health || []} />
              <AuditFeed data={auditFeed || []} />
            </div>
          </div>
        </div>
      )}

      {tab === "execution" && (
        <div className="space-y-4">
          <KpiRow variant="execution" stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-3 space-y-4">
              <ProjectHealthTable data={health || []} />
              <AuditFeed data={auditFeed || []} />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <RiskMatrix />
              <ProjectSimulationPanel projects={health || []} />
            </div>
          </div>
        </div>
      )}

      {tab === "people" && (
        <div className="space-y-4">
          <KpiRow variant="people" stats={stats} />
          <ResourceUtilization data={resources} />
        </div>
      )}
    </div>
  );
}
