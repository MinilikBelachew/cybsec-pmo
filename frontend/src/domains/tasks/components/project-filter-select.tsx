"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type ProjectOption = { id: string; name: string };

type ProjectFilterSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  projects: ProjectOption[];
  allLabel?: string;
};

export function ProjectFilterSelect({
  value,
  onValueChange,
  projects,
  allLabel = "All projects",
}: ProjectFilterSelectProps) {
  const selectedName =
    value === "all"
      ? allLabel
      : (projects.find((p) => p.id === value)?.name ?? "Select project");

  return (
    <Select value={value} onValueChange={(val) => onValueChange(val ?? "all")}>
      <SelectTrigger
        className="h-9 w-[220px] max-w-[min(100vw-2rem,220px)] shrink-0 rounded-xl border border-border/50 bg-muted/50 text-sm focus:ring-1 focus:ring-primary/30"
        title={selectedName}
      >
        <SelectValue placeholder={allLabel}>
          <span className="block min-w-0 truncate">{selectedName}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="max-h-72 w-[var(--anchor-width)] max-w-[min(100vw-2rem,320px)]"
        alignItemWithTrigger={false}
      >
        <SelectItem value="all">{allLabel}</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id} title={p.name}>
            <span className="block min-w-0 truncate">{p.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
