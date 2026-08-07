"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import {
  useCreateLessonMutation,
  useUpdateLessonMutation,
} from "../api/lessons.api";
import type { Lesson } from "../types/lessons.types";
import {
  LESSON_CATEGORIES,
  createLessonSchema,
  type LessonFormValues,
} from "../schemas/lesson.schema";
import { FormSheet } from "./form-sheet";

type ProjectOption = { id: string; name: string };

const CREATE_DEFAULTS: LessonFormValues = {
  category: "DEPLOYMENT",
  description: "",
  recommendation: "",
  tags: "",
  projectId: "none",
};

type LessonFormProps = {
  open: boolean;
  projects: ProjectOption[];
  editing?: Lesson | null;
  onCancel: () => void;
  onSuccess: () => void;
};

export function LessonForm({
  open,
  projects,
  editing = null,
  onCancel,
  onSuccess,
}: LessonFormProps) {
  const [createLesson, { isLoading: isCreating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: isUpdating }] = useUpdateLessonMutation();
  const isSaving = isCreating || isUpdating;
  const isEdit = Boolean(editing);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        category: (LESSON_CATEGORIES.includes(
          editing.category as (typeof LESSON_CATEGORIES)[number],
        )
          ? editing.category
          : "OTHER") as LessonFormValues["category"],
        description: editing.description,
        recommendation: editing.recommendation,
        tags: editing.tags?.join(", ") ?? "",
        projectId: editing.projectId || "none",
      });
    } else {
      reset(CREATE_DEFAULTS);
    }
  }, [open, editing, reset]);

  const projectId = watch("projectId");
  const category = watch("category");
  const selectedProjectName =
    projectId && projectId !== "none"
      ? projects.find((p) => p.id === projectId)?.name
      : "No project";

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      category: values.category,
      description: values.description.trim(),
      recommendation: values.recommendation.trim(),
      tags: (values.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ...(values.projectId && values.projectId !== "none"
        ? { projectId: values.projectId }
        : {}),
    };

    try {
      if (editing) {
        await updateLesson({
          id: editing.id,
          body: {
            category: payload.category,
            description: payload.description,
            recommendation: payload.recommendation,
            tags: payload.tags,
          },
        }).unwrap();
        toast.success("Lesson updated");
      } else {
        await createLesson(payload).unwrap();
        toast.success("Lesson captured");
      }
      onSuccess();
    } catch {
      toast.error(isEdit ? "Failed to update lesson" : "Failed to save lesson");
    }
  });

  const fieldErrorClass = "text-[11px] font-medium text-rose-500";

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={isEdit ? "Edit lesson" : "New lesson"}
      description="Capture what happened and the recommendation for next time."
    >
      <form
        onSubmit={onSubmit}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Category <span className="text-destructive font-bold">*</span>
              </label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(
                        (v as LessonFormValues["category"]) || "DEPLOYMENT",
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{category}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Project (optional)
              </label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v ?? "none")}
                    disabled={isEdit}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Optional project">
                        {selectedProjectName}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">
                Context <span className="text-destructive font-bold">*</span>
              </label>
              <textarea
                {...register("description")}
                rows={3}
                placeholder="What happened?"
                className={cn(
                  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  errors.description && "border-rose-500",
                )}
              />
              {errors.description && (
                <p className={fieldErrorClass}>{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">
                Recommendation{" "}
                <span className="text-destructive font-bold">*</span>
              </label>
              <textarea
                {...register("recommendation")}
                rows={3}
                placeholder="What should we do next time?"
                className={cn(
                  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  errors.recommendation && "border-rose-500",
                )}
              />
              {errors.recommendation && (
                <p className={fieldErrorClass}>
                  {errors.recommendation.message}
                </p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">
                Tags (comma-separated)
              </label>
              <Input {...register("tags")} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 me-2 animate-spin" />}
            {isEdit ? "Save changes" : "Save lesson"}
          </Button>
        </div>
      </form>
    </FormSheet>
  );
}
