"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, MessageSquare, Plus, Siren } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  useGetCustomersQuery,
  useGetProjectsQuery,
} from "@/domains/projects/api/projects.api";
import { useGetEscalationsQuery } from "../api/escalations.api";
import type { Escalation } from "../types/escalations.types";
import {
  CloseEscalationForm,
  EscalationCommForm,
  EscalationForm,
} from "./escalation-form";

export function EscalationsPage() {
  const { canEditIssues, canViewRisks, canEditRisks } = useModulePermissions();
  const canManage = canEditIssues || canEditRisks;
  const canView = canManage || canViewRisks;

  const [projectFilter, setProjectFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];
  const { data: customers = [] } = useGetCustomersQuery();

  const listParams = useMemo(
    () => (projectFilter !== "all" ? { projectId: projectFilter } : undefined),
    [projectFilter],
  );
  const { data: escalations = [], isLoading } = useGetEscalationsQuery(listParams, {
    skip: !canView,
  });

  const selectedFilterProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name;

  function toggleLogAccordion(id: string) {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view customer escalations.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Customer Escalations"
        description="Track customer escalations with severity, SLA, communication log, and closure."
        actions={
          canManage ? (
            <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
              <Plus className="size-4" />
              New escalation
            </Button>
          ) : null
        }
      />

      <Select
        value={projectFilter}
        onValueChange={(v) => setProjectFilter(v ?? "all")}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Project">
            {selectedFilterProjectName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showForm && canManage && (
        <EscalationForm
          projects={projects}
          customers={customers}
          onCancel={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : escalations.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Siren className="size-8 opacity-40" />
          No escalations found.
        </div>
      ) : (
        <div className="grid gap-4">
          {escalations.map((esc) => (
            <EscalationCard
              key={esc.id}
              escalation={esc}
              canManage={canManage}
              isClosing={closingId === esc.id}
              logsExpanded={expandedLogIds.has(esc.id)}
              onToggleLogs={() => toggleLogAccordion(esc.id)}
              onStartClose={() => setClosingId(esc.id)}
              onCancelClose={() => setClosingId(null)}
              onClosed={() => setClosingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type EscalationCardProps = {
  escalation: Escalation;
  canManage: boolean;
  isClosing: boolean;
  logsExpanded: boolean;
  onToggleLogs: () => void;
  onStartClose: () => void;
  onCancelClose: () => void;
  onClosed: () => void;
};

function EscalationCard({
  escalation: esc,
  canManage,
  isClosing,
  logsExpanded,
  onToggleLogs,
  onStartClose,
  onCancelClose,
  onClosed,
}: EscalationCardProps) {
  const logCount = esc.communications.length;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="font-medium flex flex-wrap items-center gap-2">
            <span>{esc.customerName ?? "Customer"}</span>
            <Badge variant="outline">{esc.severity}</Badge>
            <Badge variant="outline">{esc.status}</Badge>
            {esc.isOverdue && (
              <Badge
                variant="outline"
                className="text-rose-700 border-rose-200"
              >
                Overdue SLA
              </Badge>
            )}
            {esc.slaBreached && (
              <Badge
                variant="outline"
                className="text-rose-700 border-rose-200"
              >
                SLA breached
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {esc.projectName} · Owner {esc.owner?.displayName ?? "—"} · SLA{" "}
            {esc.slaTargetHrs}h
          </div>
        </div>
        {canManage && esc.status !== "Closed" && !isClosing && (
          <Button size="sm" variant="outline" onClick={onStartClose}>
            Close
          </Button>
        )}
      </div>

      {isClosing && (
        <CloseEscalationForm
          escalationId={esc.id}
          onCancel={onCancelClose}
          onClosed={onClosed}
        />
      )}

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <button
          type="button"
          onClick={onToggleLogs}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
          aria-expanded={logsExpanded}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4 text-muted-foreground" />
            Communication log
            <Badge variant="outline" className="text-[10px] font-normal">
              {logCount}
            </Badge>
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              logsExpanded && "rotate-180",
            )}
          />
        </button>

        {logsExpanded && (
          <div className="border-t border-border/40 px-3 py-3 space-y-3">
            {logCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                No communications logged yet.
              </p>
            ) : (
              <div className="space-y-2">
                {esc.communications.map((c) => (
                  <div
                    key={c.id}
                    className="text-xs rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <span className="font-medium">{c.channel}</span>
                    {" · "}
                    {c.logger?.displayName ?? "User"}
                    {" · "}
                    {new Date(c.createdAt).toLocaleString()}
                    <div className="mt-1 text-foreground">{c.content}</div>
                  </div>
                ))}
              </div>
            )}

            {canManage && esc.status !== "Closed" && (
              <EscalationCommForm escalationId={esc.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
