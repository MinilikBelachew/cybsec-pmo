"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useAuth } from "@/domains/auth";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { useGetProjectsQuery } from "@/domains/projects/api/projects.api";
import {
  useDeleteLessonMutation,
  useGetLessonsQuery,
} from "../api/lessons.api";
import type { Lesson } from "../types/lessons.types";
import { LESSON_CATEGORIES } from "../schemas/lesson.schema";
import { LessonForm } from "./lesson-form";

const LESSON_MANAGER_ROLES = new Set(["super_admin", "pmo_lead", "pm"]);

export function LessonsPage() {
  const { user } = useAuth();
  const { canViewProjects, canEditProjects } = useModulePermissions();
  const isEngineer = (user?.backendRoleCode ?? "") === "engineer";
  const canViewLessons = canViewProjects && !isEngineer;
  const canCaptureLessons = canEditProjects && !isEngineer;
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [tag, setTag] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);

  const debouncedQ = useDebounce(q, 300);
  const debouncedTag = useDebounce(tag, 300);

  const { data: projectsResponse } = useGetProjectsQuery(
    { page: 1, limit: 200 },
    { skip: !canViewLessons },
  );
  const projects = projectsResponse?.data ?? [];

  const listParams = useMemo(
    () => ({
      ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
      ...(category !== "all" ? { category } : {}),
      ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
      ...(debouncedTag.trim() ? { tag: debouncedTag.trim() } : {}),
    }),
    [debouncedQ, category, projectFilter, debouncedTag],
  );

  const { data: lessons = [], isLoading } = useGetLessonsQuery(listParams, {
    skip: !canViewLessons,
  });
  const [deleteLesson, { isLoading: isDeleting }] = useDeleteLessonMutation();

  const roleCode = user?.backendRoleCode ?? "";
  const currentUserId = user?.id;

  function canMutateLesson(lesson: Lesson): boolean {
    if (!canCaptureLessons) return false;
    if (LESSON_MANAGER_ROLES.has(roleCode)) return true;
    return Boolean(currentUserId && lesson.authorId === currentUserId);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteLesson(deleteTarget.id).unwrap();
      toast.success("Lesson deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete lesson");
    }
  }

  const selectedProjectName =
    projectFilter === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectFilter)?.name ?? "Project";

  if (!canViewLessons) {
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
          canCaptureLessons ? (
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Capture lesson
            </Button>
          ) : null
        }
      />

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
        <Select
          value={projectFilter}
          onValueChange={(v) => setProjectFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Project">
              {selectedProjectName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-[160px]"
          placeholder="Filter by tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {canCaptureLessons && (
        <LessonForm
          open={showForm}
          projects={projects}
          editing={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditing(null);
          }}
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
            {lessons.map((lesson) => {
              const allowMutate = canMutateLesson(lesson);
              return (
                <div
                  key={lesson.id}
                  className="p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{lesson.category}</Badge>
                      {lesson.projectName && (
                        <span className="text-xs text-muted-foreground">
                          {lesson.projectName}
                        </span>
                      )}
                      {lesson.tags?.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {t}
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
                  {allowMutate && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => {
                          setEditing(lesson);
                          setShowForm(true);
                        }}
                        aria-label="Edit lesson"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-600 hover:text-rose-700"
                        onClick={() => setDeleteTarget(lesson)}
                        aria-label="Delete lesson"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete lesson?"
        description={
          deleteTarget
            ? `This will permanently remove “${deleteTarget.description.slice(0, 80)}${deleteTarget.description.length > 80 ? "…" : ""}”.`
            : "This cannot be undone."
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
