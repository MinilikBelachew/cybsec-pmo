"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectRisksQuery } from "../api/risks.api";
import { scoreBadgeClass } from "../utils/form-utils";
import { ListPagination, paginateItems } from "./list-pagination";

type ProjectRisksPanelProps = {
  projectId: string;
};

export function ProjectRisksPanel({ projectId }: ProjectRisksPanelProps) {
  const { canViewRisks, canEditRisks } = useModulePermissions();
  const { data: risks = [], isLoading } = useGetProjectRisksQuery(projectId, {
    skip: !canViewRisks,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [projectId, pageSize]);

  const pageCount = Math.max(1, Math.ceil(risks.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedRisks = useMemo(
    () => paginateItems(risks, page, pageSize),
    [risks, page, pageSize],
  );

  if (!canViewRisks) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        You do not have permission to view risks for this project.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Project risks</h2>
          <p className="text-xs text-muted-foreground">
            Open items from the risk register for this workspace.
          </p>
        </div>
        {canEditRisks && (
          <Link
            href="/dashboard/risks"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open register
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center text-muted-foreground gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : risks.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <AlertTriangle className="size-8 opacity-40" />
          <p className="text-sm">No risks logged for this project.</p>
          {canEditRisks && (
            <Link
              href="/dashboard/risks"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Add in risk register
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-start px-4 py-3">Title</th>
                <th className="text-start px-4 py-3">Score</th>
                <th className="text-start px-4 py-3">Status</th>
                <th className="text-start px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {pagedRisks.map((risk) => (
                <tr key={risk.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{risk.title}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("border", scoreBadgeClass(risk.score))}
                    >
                      {risk.score} ({risk.impact}×{risk.likelihood})
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{risk.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {risk.owner?.displayName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={risks.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
