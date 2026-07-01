"use client";

import { useState } from "react";
import { Grid3x3, List } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";
import { PermissionsMatrix } from "./permissions-matrix";
import { PermissionsListSection } from "./permissions-list-section";

type PermissionsView = "matrix" | "list";

export function PermissionsPage() {
  const [view, setView] = useState<PermissionsView>("matrix");

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Permission Matrix"
        description="Compare role access across modules and actions. Hover granted cells for record scope."
      />

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setView("matrix")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all -mb-px",
            view === "matrix"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Grid3x3 className="size-4" />
          Matrix
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all -mb-px",
            view === "list"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-4" />
          Detail list
        </button>
      </div>

      {view === "matrix" ? <PermissionsMatrix /> : <PermissionsListSection />}
    </div>
  );
}
