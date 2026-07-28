"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Save, ScanSearch } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  useGetDataQualityFlagsQuery,
  useGetDataQualityRulesQuery,
  useResolveDataQualityFlagMutation,
  useScanDataQualityMutation,
  useUpdateDataQualityRulesMutation,
} from "../api/reports.api";
import type { DataQualityFlagType } from "../types/reports.types";

const FLAG_TYPES: DataQualityFlagType[] = [
  "MISSING_TIMESHEET",
  "UNAPPROVED_TIMESHEET",
  "STALE_INTEGRATION",
  "INCOMPLETE_PROJECT",
];

export function DataQualityPage() {
  const { data: flags = [], isLoading } = useGetDataQualityFlagsQuery();
  const { data: rules } = useGetDataQualityRulesQuery();
  const [scan, { isLoading: scanning }] = useScanDataQualityMutation();
  const [resolve, { isLoading: resolving }] =
    useResolveDataQualityFlagMutation();
  const [saveRules, { isLoading: saving }] =
    useUpdateDataQualityRulesMutation();
  const [includedOverride, setIncluded] = useState<
    DataQualityFlagType[] | null
  >(null);
  const [excludedOverride, setExcluded] = useState<
    DataQualityFlagType[] | null
  >(null);
  const included = includedOverride ?? rules?.includeFlagTypes ?? [];
  const excluded = excludedOverride ?? rules?.excludeFlagTypes ?? [];

  const toggle = (type: DataQualityFlagType, target: "include" | "exclude") => {
    if (target === "include") {
      setIncluded((override) => {
        const current = override ?? included;
        return current.includes(type)
          ? current.filter((value) => value !== type)
          : [...current, type];
      });
      setExcluded((override) =>
        (override ?? excluded).filter((value) => value !== type),
      );
    } else {
      setExcluded((override) => {
        const current = override ?? excluded;
        return current.includes(type)
          ? current.filter((value) => value !== type)
          : [...current, type];
      });
      setIncluded((override) =>
        (override ?? included).filter((value) => value !== type),
      );
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Data Quality"
        description="Find and resolve incomplete or inconsistent project data."
      />
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Scan rules</h2>
            <p className="text-xs text-muted-foreground">
              With no include selections, all non-excluded flag types are
              scanned.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              try {
                await saveRules({
                  includeFlagTypes: included,
                  excludeFlagTypes: excluded,
                }).unwrap();
                toast.success("Data quality rules saved");
              } catch {
                toast.error("Could not save rules");
              }
            }}
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save rules
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {FLAG_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">{type.replaceAll("_", " ")}</span>
              <div className="flex gap-3">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={included.includes(type)}
                    onChange={() => toggle(type, "include")}
                  />
                  Include
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={excluded.includes(type)}
                    onChange={() => toggle(type, "exclude")}
                  />
                  Exclude
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          disabled={scanning}
          onClick={async () => {
            try {
              await scan({}).unwrap();
              toast.success("Data quality scan complete");
            } catch {
              toast.error("Scan failed");
            }
          }}
        >
          {scanning ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ScanSearch className="mr-2 size-4" />
          )}
          Scan all projects
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">Description</th>
              <th className="p-3">Project</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-muted-foreground"
                >
                  Loading flags…
                </td>
              </tr>
            ) : flags.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-muted-foreground"
                >
                  No data quality flags.
                </td>
              </tr>
            ) : (
              flags.map((flag) => (
                <tr key={flag.id}>
                  <td className="p-3 font-medium">{flag.flagType}</td>
                  <td className="max-w-md p-3">{flag.description}</td>
                  <td className="p-3 text-muted-foreground">
                    {flag.project?.name ?? flag.projectId ?? "Portfolio"}
                  </td>
                  <td className="p-3 capitalize">{flag.severity}</td>
                  <td className="p-3">
                    {flag.isResolved ? "Resolved" : "Open"}
                  </td>
                  <td className="p-3 text-right">
                    {!flag.isResolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resolving}
                        onClick={async () => {
                          try {
                            await resolve(flag.id).unwrap();
                            toast.success("Flag resolved");
                          } catch {
                            toast.error("Could not resolve flag");
                          }
                        }}
                      >
                        <CheckCircle2 className="mr-1 size-4" />
                        Resolve
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
