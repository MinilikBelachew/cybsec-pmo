"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Siren } from "lucide-react";
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
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  useGetCustomersQuery,
  useGetProjectsQuery,
} from "@/domains/projects/api/projects.api";
import { useGetEscalationsQuery } from "../api/escalations.api";
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

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : escalations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Siren className="size-8 opacity-40" />
            No escalations found.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {escalations.map((esc) => (
              <div key={esc.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {esc.customerName ?? "Customer"}
                      <Badge variant="outline">{esc.severity}</Badge>
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
                    <div className="text-xs text-muted-foreground mt-1">
                      {esc.projectName} · Owner {esc.owner?.displayName ?? "—"} ·
                      SLA {esc.slaTargetHrs}h · {esc.status}
                    </div>
                  </div>
                  {canManage &&
                    esc.status !== "Closed" &&
                    closingId !== esc.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClosingId(esc.id)}
                      >
                        Close
                      </Button>
                    )}
                </div>

                {closingId === esc.id && (
                  <CloseEscalationForm
                    escalationId={esc.id}
                    onCancel={() => setClosingId(null)}
                    onClosed={() => setClosingId(null)}
                  />
                )}

                <div className="space-y-1">
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

                {canManage && esc.status !== "Closed" && (
                  <EscalationCommForm escalationId={esc.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
