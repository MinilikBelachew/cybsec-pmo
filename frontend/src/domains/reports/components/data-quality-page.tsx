"use client";
import { Spinner } from "@/shared/components/spinner";

import { useEffect, useState } from "react";
import { CheckCircle2, Save, ScanSearch } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { FilterSelect } from "@/shared/components/filter-select";
import { Button } from "@/shared/ui/button";
import { useGetProjectsQuery } from "@/domains/projects";
import { cn } from "@/shared/utils/cn";
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

const FLAG_META: Record<
  DataQualityFlagType,
  { title: string; description: string }
> = {
  MISSING_TIMESHEET: {
    title: "Missing timesheet",
    description: "Allocated people with no timesheet for the current week.",
  },
  UNAPPROVED_TIMESHEET: {
    title: "Unapproved timesheet",
    description: "Submitted timesheets waiting for approval.",
  },
  STALE_INTEGRATION: {
    title: "Stale integration",
    description: "Keka sync has not succeeded recently.",
  },
  INCOMPLETE_PROJECT: {
    title: "Incomplete project",
    description: "Projects missing required setup data.",
  },
};

const FILTER_TRIGGER =
  "h-10 w-[220px] max-w-[min(100%,280px)] shrink-0 rounded-lg border-border/60 bg-background px-3 shadow-none";

const FLAG_TYPE_OPTIONS = FLAG_TYPES.map((type) => ({
  id: type,
  label: type.replaceAll("_", " "),
}));

const STATUS_FILTER_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20].map((size) => ({
  id: String(size),
  label: `${size} per page`,
}));

type RuleMode = "include" | "exclude";

export function DataQualityPage() {
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterFlagType, setFilterFlagType] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "open" | "resolved">(
    "",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: list, isLoading, isFetching } = useGetDataQualityFlagsQuery({
    projectId: filterProjectId || undefined,
    flagType: filterFlagType || undefined,
    resolved:
      filterStatus === "open"
        ? false
        : filterStatus === "resolved"
          ? true
          : undefined,
    page,
    limit: pageSize,
  });
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

  const flags = list?.data ?? [];
  const total = list?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const projectOptions =
    projects?.data.map((project) => ({
      id: project.id,
      label: project.name,
    })) ?? [];

  useEffect(() => {
    setPage(1);
  }, [filterProjectId, filterFlagType, filterStatus, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const getMode = (type: DataQualityFlagType): RuleMode =>
    excluded.includes(type) ? "exclude" : "include";

  const setMode = (type: DataQualityFlagType, mode: RuleMode) => {
    setIncluded((override) => {
      const current = override ?? included;
      const without = current.filter((value) => value !== type);
      return mode === "include" ? [...without, type] : without;
    });
    setExcluded((override) => {
      const current = override ?? excluded;
      const without = current.filter((value) => value !== type);
      return mode === "exclude" ? [...without, type] : without;
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Data Quality"
        description="Find and resolve incomplete or inconsistent project data."
      />

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-bold">Scan rules</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Include</span> runs
              the check on scan.{" "}
              <span className="font-medium text-foreground">Exclude</span> skips
              it.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
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
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save rules
          </Button>
        </div>

        <ul className="divide-y divide-border/50">
          {FLAG_TYPES.map((type) => {
            const meta = FLAG_META[type];
            const mode = getMode(type);
            return (
              <li
                key={type}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`${meta.title} scan rule`}
                  className="inline-flex shrink-0 rounded-lg border border-border/70 bg-muted/40 p-0.5"
                >
                  {(
                    [
                      { value: "include", label: "Include" },
                      { value: "exclude", label: "Exclude" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={mode === option.value}
                      onClick={() => setMode(type, option.value)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        mode === option.value
                          ? option.value === "exclude"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "bg-emerald-600 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <FilterSelect
          value={filterProjectId || null}
          onValueChange={(next) => setFilterProjectId(next ?? "")}
          options={projectOptions}
          noneLabel="All projects"
          searchable
          searchPlaceholder="Search projects..."
          triggerClassName={FILTER_TRIGGER}
        />
        <FilterSelect
          value={filterFlagType || null}
          onValueChange={(next) => setFilterFlagType(next ?? "")}
          options={FLAG_TYPE_OPTIONS}
          noneLabel="All flag types"
          triggerClassName={cn(FILTER_TRIGGER, "w-[200px]")}
        />
        <FilterSelect
          value={filterStatus || null}
          onValueChange={(next) =>
            setFilterStatus((next as "" | "open" | "resolved") ?? "")
          }
          options={STATUS_FILTER_OPTIONS}
          noneLabel="All statuses"
          triggerClassName={cn(FILTER_TRIGGER, "w-[160px]")}
        />
        {(filterProjectId || filterFlagType || filterStatus) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterProjectId("");
              setFilterFlagType("");
              setFilterStatus("");
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
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
              <Spinner size="sm" className="mr-2" />
            ) : (
              <ScanSearch className="mr-2 size-4" />
            )}
            Scan all projects
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
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
            <tbody className={cn("divide-y", isFetching && "opacity-70")}>
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
                    No data quality flags match the current filters.
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

        {total > 0 && (
          <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                value={String(pageSize)}
                onValueChange={(next) =>
                  setPageSize(Number(next ?? pageSize) || pageSize)
                }
                options={PAGE_SIZE_OPTIONS}
                noneLabel={`${pageSize} per page`}
                allowNone={false}
                triggerClassName="h-8 w-[130px] rounded-lg border-border/60 bg-background px-2 shadow-none"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
