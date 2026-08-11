"use client";
import { Spinner } from "@/shared/components/spinner";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import {
  useGetHealthRulesQuery,
  useUpdateHealthRulesMutation,
} from "@/domains/reports/api/reports.api";
import type { HealthRule } from "@/domains/reports/types/reports.types";

export function HealthRulesSection() {
  const { data = [], isLoading } = useGetHealthRulesQuery();
  const [edits, setEdits] = useState<Record<string, Partial<HealthRule>>>({});
  const [save, { isLoading: saving }] = useUpdateHealthRulesMutation();
  const rules = data.map((rule) => ({ ...rule, ...edits[rule.id] }));

  const setThreshold = (id: string, key: "greenThreshold" | "amberThreshold" | "redThreshold", value: string) => {
    setEdits((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value === "" ? null : Number(value) },
    }));
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="text-base font-bold">Project health rules</h2><p className="text-sm text-muted-foreground">Configure the score thresholds used for live RAG health evaluation.</p></div>
      {isLoading ? <div className="flex justify-center py-10"><Spinner size="md" /></div> : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_repeat(3,120px)]">
              <div><p className="font-semibold capitalize">{rule.dimension}</p><p className="text-xs text-muted-foreground">Unit: {rule.unit ?? "score"} · {rule.version}</p></div>
              {(["greenThreshold", "amberThreshold", "redThreshold"] as const).map((key) => <label key={key} className="space-y-1 text-xs font-semibold capitalize">{key.replace("Threshold", "")}<input type="number" value={rule[key] ?? ""} onChange={(e) => setThreshold(rule.id, key, e.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" /></label>)}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end"><Button disabled={saving || isLoading} onClick={async () => { try { await save(rules.map((rule) => ({ dimension: rule.dimension, greenThreshold: rule.greenThreshold, amberThreshold: rule.amberThreshold, ...(rule.redThreshold == null ? {} : { redThreshold: rule.redThreshold }), ...(rule.unit ? { unit: rule.unit } : {}), isActive: rule.isActive }))).unwrap(); toast.success("Health rules saved"); } catch { toast.error("Could not save health rules"); } }}><Save className="mr-2 size-4" />Save rules</Button></div>
    </section>
  );
}
