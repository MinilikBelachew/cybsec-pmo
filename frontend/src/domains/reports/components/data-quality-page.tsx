"use client";

import { CheckCircle2, Loader2, ScanSearch } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  useGetDataQualityFlagsQuery,
  useResolveDataQualityFlagMutation,
  useScanDataQualityMutation,
} from "../api/reports.api";

export function DataQualityPage() {
  const { data: flags = [], isLoading } = useGetDataQualityFlagsQuery();
  const [scan, { isLoading: scanning }] = useScanDataQualityMutation();
  const [resolve, { isLoading: resolving }] = useResolveDataQualityFlagMutation();
  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Data Quality" description="Find and resolve incomplete or inconsistent project data." />
      <div className="flex justify-end">
        <Button disabled={scanning} onClick={async () => { try { await scan({}).unwrap(); toast.success("Data quality scan complete"); } catch { toast.error("Scan failed"); } }}>
          {scanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ScanSearch className="mr-2 size-4" />}Scan all projects
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Type</th><th className="p-3">Description</th><th className="p-3">Project</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y">
            {isLoading ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Loading flags…</td></tr> : flags.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No data quality flags.</td></tr> : flags.map((flag) => (
              <tr key={flag.id}>
                <td className="p-3 font-medium">{flag.flagType}</td><td className="max-w-md p-3">{flag.description}</td><td className="p-3 text-muted-foreground">{flag.project?.name ?? flag.projectId ?? "Portfolio"}</td>
                <td className="p-3 capitalize">{flag.severity}</td><td className="p-3">{flag.isResolved ? "Resolved" : "Open"}</td>
                <td className="p-3 text-right">{!flag.isResolved && <Button variant="outline" size="sm" disabled={resolving} onClick={async () => { try { await resolve(flag.id).unwrap(); toast.success("Flag resolved"); } catch { toast.error("Could not resolve flag"); } }}><CheckCircle2 className="mr-1 size-4" />Resolve</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
