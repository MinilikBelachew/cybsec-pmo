"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useGetSurfacedLessonsQuery } from "../api/lessons.api";

type SurfacedLessonsPanelProps = {
  projectId?: string;
  departmentId?: string;
  category?: string;
  title?: string;
  description?: string;
};

export function SurfacedLessonsPanel({
  projectId,
  departmentId,
  category,
  title = "Relevant lessons learned",
  description = "Review prior lessons before setup or closure.",
}: SurfacedLessonsPanelProps) {
  const canQuery = Boolean(projectId || departmentId || category);
  const { data: lessons = [], isLoading, isError } = useGetSurfacedLessonsQuery(
    {
      projectId: projectId || undefined,
      departmentId: departmentId || undefined,
      category: category || undefined,
    },
    { skip: !canQuery },
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <BookOpen className="size-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="size-3.5 animate-spin" /> Loading lessons…
        </div>
      ) : isError ? (
        <p className="text-xs text-muted-foreground py-2">
          Lessons could not be loaded.
        </p>
      ) : !canQuery ? (
        <p className="text-xs text-muted-foreground py-2">
          Select a department to see related lessons.
        </p>
      ) : lessons.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No matching lessons yet.
        </p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {lessons.slice(0, 8).map((lesson) => (
            <li
              key={lesson.id}
              className="rounded-lg border border-border/40 bg-background/70 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {lesson.category}
                </span>
                {lesson.projectName && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {lesson.projectName}
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 line-clamp-2">{lesson.description}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {lesson.recommendation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
