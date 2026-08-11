"use client";
import { Spinner } from "@/shared/components/spinner";

import { Suspense } from "react";
import { ProjectWorkspace } from "@/domains/projects";


function ProjectWorkspaceFallback() {
  return (
    <div className="flex h-96 items-center justify-center text-muted-foreground">
      <Spinner size="md" className="mr-2" />
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
