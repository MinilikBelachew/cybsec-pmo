"use client";

import React, { useMemo } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { phaseSchema, type PhaseFormValues } from "../../schemas/phase/phase.schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { ProjectPhase } from "../../types/projects.types";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { CalendarIcon } from "lucide-react";
import { toDateString, formatDateLabel } from "@/shared/utils/date";

interface PhaseFormProps {
  initialValues: PhaseFormValues;
  onSubmit: (values: PhaseFormValues) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  existingPhases?: ProjectPhase[];
  phaseId?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive mt-1">{message}</p>;
}

export function PhaseForm({
  initialValues,
  onSubmit,
  onCancel,
  isSaving,
  existingPhases = [],
  phaseId,
}: PhaseFormProps) {
  // Dynamically define schema with overlap checking
  const schema = useMemo(() => {
    return phaseSchema
      .refine(
        (data) => {
          if (!data.startDate || !data.endDate) return true;
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);

          // Check if it overlaps with any other phase's date range
          const overlappingPhase = existingPhases.find((p) => {
            // If editing, skip checking against the phase itself
            if (phaseId && p.id === phaseId) return false;
            if (!p.startDate || !p.endDate) return false;

            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);

            return start <= pEnd && end >= pStart;
          });

          return !overlappingPhase;
        },
        {
          message: "Phase dates overlap with an existing phase in this project",
          path: ["startDate"],
        }
      );
  }, [existingPhases, phaseId]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PhaseFormValues>({
    resolver: zodResolver(schema) as Resolver<PhaseFormValues>,
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col justify-between overflow-hidden">
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">
              {initialValues.name ? "Edit Phase Details" : "Create New Phase"}
            </h3>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phase-name" className="text-xs font-semibold">Phase Name *</Label>
              <Input
                id="phase-name"
                placeholder="e.g. Phase 1 - Discovery"
                className="h-9"
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phase-desc" className="text-xs font-semibold">Description</Label>
              <Input
                id="phase-desc"
                placeholder="Understand scope and align resources"
                className="h-9"
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Date</Label>
                <Controller
                  control={control}
                  name="startDate"
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
                <FieldError message={errors.startDate?.message} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Date</Label>
                <Controller
                  control={control}
                  name="endDate"
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
                <FieldError message={errors.endDate?.message} />
              </div>
            </div>

            <div className="w-1/2 space-y-1.5">
              <Label htmlFor="phase-status" className="text-xs font-semibold">Status (Manual)</Label>
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
                        {field.value ? field.value.replace("_", " ") : "Select status"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900">
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On_Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.status?.message} />
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
