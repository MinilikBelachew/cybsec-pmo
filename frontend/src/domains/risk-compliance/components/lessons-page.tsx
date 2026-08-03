"use client";

import { useState } from "react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectsQuery } from "@/domains/projects/api/projects.api";
import {
  useGetLessonsQuery,
  useGetSurfacedLessonsQuery,
} from "../api/lessons.api";
import { LESSON_CATEGORIES } from "../schemas/lesson.schema";
import { LessonForm } from "./lesson-form";

export function LessonsPage() {
  const { canViewProjects, canEditProjects } = useModulePermissions();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];

  const { data: lessons = [], isLoading } = useGetLessonsQuery(
    {
      ...(q ? { q } : {}),
      ...(category !== "all" ? { category } : {}),
    },
    { skip: !canViewProjects },
  );
  const { data: surfaced = [] } = useGetSurfacedLessonsQuery(undefined, {
    skip: !canViewProjects,
  });

  if (!canViewProjects) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        You do not have permission to view lessons learned.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Lessons Learned"
        description="Searchable knowledge base with categories, tags, and surfacing for project setup/closure."
        actions={
          canEditProjects ? (
            <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
              <Plus className="size-4" />
              Capture lesson
            </Button>
          ) : null
        }
      />

      {surfaced.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">Surfaced for current work</p>
          <div className="flex flex-wrap gap-2">
            {surfaced.slice(0, 6).map((lesson) => (
              <Badge key={lesson.id} variant="outline">
                {lesson.category}: {lesson.description.slice(0, 48)}
                {lesson.description.length > 48 ? "…" : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search lessons…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          value={category}
          onValueChange={(v) => setCategory(v ?? "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category">
              {category === "all" ? "All categories" : category}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {LESSON_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showForm && canEditProjects && (
        <LessonForm
          projects={projects}
          onCancel={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : lessons.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <BookOpen className="size-8 opacity-40" />
            No lessons found.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="p-4 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{lesson.category}</Badge>
                  {lesson.projectName && (
                    <span className="text-xs text-muted-foreground">
                      {lesson.projectName}
                    </span>
                  )}
                  {lesson.tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm font-medium">{lesson.description}</p>
                <p className="text-xs text-muted-foreground">
                  {lesson.recommendation}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lesson.author?.displayName ?? "Author"} ·{" "}
                  {new Date(lesson.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
