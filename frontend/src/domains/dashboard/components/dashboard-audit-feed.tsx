"use client";

import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import { Activity, FolderKanban, Users, FileText, Clock } from "lucide-react";
import { AuditLogFeedItem } from "../api/dashboard.api";

const MODULE_COLOR: Record<string, string> = {
  task:     "bg-violet-100 text-violet-600 dark:bg-violet-900/30",
  risk:     "bg-rose-100 text-rose-600 dark:bg-rose-900/30",
  project:  "bg-purple-100 text-purple-600 dark:bg-purple-900/30",
  time:     "bg-sky-100 text-sky-600 dark:bg-sky-900/30",
  people:   "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30",
  doc:      "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
  settings: "bg-muted text-muted-foreground",
};

const ACTION_NAMES: Record<string, string> = {
  updatedTaskStatus: "updated task status",
  loggedRisk: "logged risk",
  createdProject: "created project",
  submittedTimesheet: "submitted timesheet",
  addedTeamMember: "added team member",
  uploadedDocument: "uploaded document",
  changedRBAC: "changed RBAC",
  closedIssue: "closed issue",
};

function getIcon(mod: string) {
  switch (mod) {
    case "project": return FolderKanban;
    case "people":  return Users;
    case "doc":     return FileText;
    case "time":    return Clock;
    default:        return Activity;
  }
}

export function AuditFeed({ data }: { data: AuditLogFeedItem[] }) {
  const router = useRouter();
  const rows = data || [];

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 flex flex-col h-full space-y-3 justify-between">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-bold">Audit Log</p>
        <span
          onClick={() => router.push("/dashboard/audit")}
          className="text-xs text-[#ff6000] font-semibold cursor-pointer hover:underline"
        >
          View all activities
        </span>
      </div>

      <div className="flex-1 space-y-0.5 overflow-auto scrollbar-none min-h-[160px]">
        {rows.map((entry, i) => {
          const Icon = getIcon(entry.module);
          return (
            <div
              key={i}
              className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0 hover:bg-muted/30 rounded-lg px-1.5 transition-colors cursor-default group"
            >
              <div className={cn("size-7 rounded-full flex items-center justify-center shrink-0", MODULE_COLOR[entry.module] || MODULE_COLOR.settings)}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">
                  <span className="font-semibold text-foreground">{entry.actor}</span>
                  <span className="text-muted-foreground"> {ACTION_NAMES[entry.actionKey] || entry.actionKey} </span>
                  <span className="font-medium text-foreground truncate">{entry.target}</span>
                </p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">{entry.time} ago</p>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-10">No recent activity.</p>
        )}
      </div>
    </div>
  );
}
