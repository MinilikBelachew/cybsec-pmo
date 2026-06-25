"use client";

import React from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { milestoneSchema, type MilestoneFormValues } from "../schemas/milestone.schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { ProjectPhase } from "../types/projects.types";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { CalendarIcon } from "lucide-react";
import { toDateString, formatDateLabel } from "@/shared/utils/date";

interface MilestoneFormProps {
  initialValues: MilestoneFormValues;
  phases: ProjectPhase[];
  onSubmit: (values: MilestoneFormValues) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive mt-1">{message}</p>;
}

export function MilestoneForm({ initialValues, phases, onSubmit, onCancel, isSaving }: MilestoneFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema) as Resolver<MilestoneFormValues>,
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col justify-between overflow-hidden">
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {initialValues.title ? "Edit Milestone" : "Create New Milestone"}
            </h3>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-title" className="text-xs font-semibold">Milestone Title *</Label>
              <Input
                id="milestone-title"
                placeholder="e.g. Kickoff Meeting Completed"
                className="h-9 dark:bg-slate-900/50"
                {...register("title")}
              />
              <FieldError message={errors.title?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Date *</Label>
              <Controller
                control={control}
                name="targetDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm"
                    >
                      <span className={field.value ? "" : "text-muted-foreground"}>
                        {formatDateLabel(field.value)}
                      </span>
                      <CalendarIcon className="size-4 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? toDateString(date) : "")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              <FieldError message={errors.targetDate?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="milestone-weight" className="text-xs font-semibold">Weight % (Optional)</Label>
                <Input
                  id="milestone-weight"
                  type="number"
                  min="0"
                  max="100"
                  className="h-9 dark:bg-slate-900/50"
                  {...register("weight")}
                />
                <FieldError message={errors.weight?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="milestone-status" className="text-xs font-semibold">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Select status">
                          {field.value || "Select status"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900">
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.status?.message} />
              </div>
            </div>

            <div className="w-1/2 space-y-1.5">
              <Label htmlFor="milestone-phase" className="text-xs font-semibold">Associate with Phase</Label>
              <Controller
                control={control}
                name="phaseId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select phase">
                        {field.value === "unassigned"
                          ? "Unassigned (None)"
                          : phases.find((p) => p.id === field.value)?.name || "Select phase"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900">
                      <SelectItem value="unassigned">Unassigned (None)</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.phaseId?.message} />
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
