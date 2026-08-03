"use client";

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
import { useCreateLessonMutation } from "../api/lessons.api";
import {
  LESSON_CATEGORIES,
  createLessonSchema,
  type LessonFormValues,
} from "../schemas/lesson.schema";

type ProjectOption = { id: string; name: string };

const CREATE_DEFAULTS: LessonFormValues = {
  category: "DEPLOYMENT",
  description: "",
  recommendation: "",
  tags: "",
  projectId: "none",
};

type LessonFormProps = {
  projects: ProjectOption[];
  onCancel: () => void;
  onSuccess: () => void;
};

export function LessonForm({ projects, onCancel, onSuccess }: LessonFormProps) {
  const [createLesson, { isLoading: isCreating }] = useCreateLessonMutation();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  const projectId = watch("projectId");
  const category = watch("category");
  const selectedProjectName =
    projectId && projectId !== "none"
      ? projects.find((p) => p.id === projectId)?.name
      : "No project";

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createLesson({
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
      }).unwrap();
      toast.success("Lesson captured");
      onSuccess();
    } catch {
      toast.error("Failed to save lesson");
    }
  });

  const fieldErrorClass = "text-[11px] font-medium text-rose-500";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
      noValidate
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Category</label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) =>
                  field.onChange((v as LessonFormValues["category"]) || "DEPLOYMENT")
                }
              >
                <SelectTrigger>
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
          <label className="text-xs text-muted-foreground">Project (optional)</label>
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v ?? "none")}
              >
                <SelectTrigger>
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
          <label className="text-xs text-muted-foreground">Context</label>
          <Input
            {...register("description")}
            placeholder="What happened?"
            className={cn(errors.description && "border-rose-500")}
          />
          {errors.description && (
            <p className={fieldErrorClass}>{errors.description.message}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">Recommendation</label>
          <Input
            {...register("recommendation")}
            placeholder="What should we do next time?"
            className={cn(errors.recommendation && "border-rose-500")}
          />
          {errors.recommendation && (
            <p className={fieldErrorClass}>{errors.recommendation.message}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">
            Tags (comma-separated)
          </label>
          <Input {...register("tags")} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating && <Loader2 className="size-4 me-2 animate-spin" />}
          Save lesson
        </Button>
      </div>
    </form>
  );
}
