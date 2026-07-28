"use client";

import { Loader2 } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { useGetStatusReportQuery } from "../api/reports.api";

function SnapshotSection({ name, value }: { name: string; value: unknown }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold capitalize">{name.replace(/([A-Z])/g, " $1")}</h2>
      {value && typeof value === "object" ? (
        <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">{String(value ?? "—")}</p>
      )}
    </section>
  );
}

export function StatusReportPreviewPage({ id }: { id: string }) {
  const { data: report, isLoading, isError } = useGetStatusReportQuery(id);
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>;
  if (isError || !report) return <p className="py-20 text-center text-sm text-rose-500">Status report could not be loaded.</p>;
  const snapshot = report.dataSnapshot ?? {};
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={`${report.reportType} Preview`}
        description={`${report.project?.name ?? report.projectId} · v${report.version} · ${report.status}`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(snapshot).map(([name, value]) => <SnapshotSection key={name} name={name} value={value} />)}
        {Object.keys(snapshot).length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:col-span-2">This report has no snapshot sections.</p>}
      </div>
    </div>
  );
}
