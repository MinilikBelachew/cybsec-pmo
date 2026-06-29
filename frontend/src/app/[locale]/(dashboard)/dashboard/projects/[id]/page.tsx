"use client";

import { Suspense } from "react";
import { ProjectWorkspace } from "@/domains/projects";
import { Loader2 } from "lucide-react";

function ProjectWorkspaceFallback() {
  return (
    <div className="flex h-96 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 size-6 animate-spin" />
      Loading workspace…
    </div>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<ProjectWorkspaceFallback />}>
      <ProjectWorkspace />
    </Suspense>
  );
}
