"use client";

import Link from "next/link";
import {
  BookOpen,
  Building2,
  CalendarDays,
  Plug,
  Users,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";

type IntegrationCard = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  live?: boolean;
  tags: string[];
};

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: "keka",
    name: "Keka HR",
    description:
      "Employee master sync, leave, timesheet push, allocation sync, and failed-record recovery.",
    icon: Users,
    href: "/dashboard/integrations/keka",
    live: true,
    tags: ["HR", "Timesheets", "Live"],
  },
  {
    id: "zoho-crm",
    name: "Zoho CRM",
    description: "Revenue and opportunity sync for financial reporting.",
    icon: Building2,
    tags: ["CRM", "Coming soon"],
  },
  {
    id: "zoho-books",
    name: "Zoho Books",
    description: "Invoice and charter financial integration.",
    icon: BookOpen,
    tags: ["Finance", "Coming soon"],
  },
  {
    id: "teams-calendar",
    name: "Teams & Calendar",
    description: "Meeting and calendar collaboration connectors.",
    icon: CalendarDays,
    tags: ["Collaboration", "Coming soon"],
  },
];

export function IntegrationsHubPage() {
  const liveCount = INTEGRATIONS.filter((item) => item.live).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-10">
      <PageHeader
        title="Integrations"
        description={`${liveCount} live connector · ${INTEGRATIONS.length - liveCount} planned. Manage admin sync and recovery tools here.`}
      />

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Admin integrations workspace</p>
        <p className="mt-1 text-muted-foreground">
          Keka is available now. Additional connectors will appear here as later phases land —
          without mixing them into the Audit Trail activity log.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((item) => {
          const Icon = item.icon;
          const card = (
            <div
              className={cn(
                "group flex h-full flex-col rounded-2xl border bg-card transition-all duration-150",
                item.live
                  ? "border-primary/30 hover:border-primary/50 hover:shadow-sm"
                  : "border-border/60 opacity-90",
              )}
            >
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      item.live
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  {item.live ? (
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
                  <h3 className="text-sm font-bold leading-tight">{item.name}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
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
                {item.live && item.href ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Plug className="size-3.5" />
                    Open connector
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    Available in a later phase
                  </span>
                )}
              </div>
            </div>
          );

          if (item.live && item.href) {
            return (
              <Link key={item.id} href={item.href} className="block h-full">
                {card}
              </Link>
            );
          }

          return <div key={item.id}>{card}</div>;
        })}
      </div>
    </div>
  );
}
