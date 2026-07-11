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
import { EntityAttachmentsSection } from "../documents/entity-attachments-section";
import type { WorkspaceDocument } from "../../types/project-documents.types";

interface PhaseFormProps {
  initialValues: PhaseFormValues;
  onSubmit: (values: PhaseFormValues, draftFiles: File[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  existingPhases?: ProjectPhase[];
  phaseId?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  documents?: WorkspaceDocument[];
  isDocumentsLoading?: boolean;
  onDeleteDocument?: (documentId: string) => void;
  onImmediateUpload?: (files: File[]) => Promise<void>;
  isUploadingDocument?: boolean;
  isDeletingDocument?: boolean;
  canAttach?: boolean;
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
  projectStartDate,
  projectEndDate,
  documents = [],
  isDocumentsLoading = false,
  onDeleteDocument,
  onImmediateUpload,
  isUploadingDocument = false,
  isDeletingDocument = false,
  canAttach = true,
}: PhaseFormProps) {
  const [draftFiles, setDraftFiles] = React.useState<File[]>([]);

  // Parallel phases are allowed (DEF-P1-046): only enforce end≥start and project bounds.
  const schema = useMemo(() => {
    return phaseSchema
      .refine(
        (data) => {
          if (!data.startDate || !data.endDate) return true;
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          return end >= start;
        },
        {
          message: "End date must be on or after start date",
          path: ["endDate"],
        }
      )
      .refine(
        (data) => {
          if (!projectStartDate || !data.startDate) return true;
          const projStart = new Date(projectStartDate);
          const phaseStart = new Date(data.startDate);
          projStart.setHours(0, 0, 0, 0);
          phaseStart.setHours(0, 0, 0, 0);
          return phaseStart >= projStart;
        },
        {
          message: projectStartDate 
            ? `Start date must be on or after project start date (${new Date(projectStartDate).toLocaleDateString()})` 
            : "Start date is before project start date",
          path: ["startDate"],
        }
      )
      .refine(
        (data) => {
          if (!projectEndDate || !data.endDate) return true;
          const projEnd = new Date(projectEndDate);
          const phaseEnd = new Date(data.endDate);
          projEnd.setHours(0, 0, 0, 0);
          phaseEnd.setHours(0, 0, 0, 0);
          return phaseEnd <= projEnd;
        },
        {
          message: projectEndDate 
            ? `End date must be on or before project end date (${new Date(projectEndDate).toLocaleDateString()})` 
            : "End date is after project end date",
          path: ["endDate"],
        }
      );
  }, [projectStartDate, projectEndDate]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<PhaseFormValues>({
    resolver: zodResolver(schema) as Resolver<PhaseFormValues>,
    defaultValues: initialValues,
  });

  const watchedStartDate = watch("startDate");

  // Build date ranges for existing phases to highlight in the calendar
  const existingPhaseRanges = useMemo(() =>
    existingPhases
      .filter((p) => {
        if (phaseId && p.id === phaseId) return false;
        return !!(p.startDate && p.endDate);
      })
      .map((p) => ({
        from: new Date(p.startDate!),
        to: new Date(p.endDate!),
      })),
    [existingPhases, phaseId]
  );

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values, draftFiles))}
      className="flex-1 flex flex-col justify-between overflow-hidden"
    >
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-4">
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
                <Label className="text-xs font-semibold">Start Date *</Label>
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
                          modifiers={{ existingPhase: existingPhaseRanges }}
                          modifiersStyles={{
                            existingPhase: {
                              backgroundColor: "hsl(38 92% 50% / 0.15)",
                              color: "hsl(38 92% 35%)",
                              fontWeight: "600",
                              borderRadius: "0",
                            },
                          }}
                          disabled={(date) => {
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            if (projectStartDate) {
                              const start = new Date(projectStartDate);
                              start.setHours(0, 0, 0, 0);
                              if (d < start) return true;
                            }
                            if (projectEndDate) {
                              const end = new Date(projectEndDate);
                              end.setHours(0, 0, 0, 0);
                              if (d > end) return true;
                            }
                            return false;
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                <FieldError message={errors.startDate?.message} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Date *</Label>
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
                          modifiers={{ existingPhase: existingPhaseRanges }}
                          modifiersStyles={{
                            existingPhase: {
                              backgroundColor: "hsl(38 92% 50% / 0.15)",
                              color: "hsl(38 92% 35%)",
                              fontWeight: "600",
                              borderRadius: "0",
                            },
                          }}
                          disabled={(date) => {
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            if (watchedStartDate) {
                              const start = new Date(watchedStartDate);
                              start.setHours(0, 0, 0, 0);
                              if (d < start) return true;
                            } else if (projectStartDate) {
                              const start = new Date(projectStartDate);
                              start.setHours(0, 0, 0, 0);
                              if (d < start) return true;
                            }
                            if (projectEndDate) {
                              const end = new Date(projectEndDate);
                              end.setHours(0, 0, 0, 0);
                              if (d > end) return true;
                            }
                            return false;
                          }}
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

          <Separator />

          <EntityAttachmentsSection
            title="Phase files"
            documents={documents}
            draftFiles={draftFiles}
            onDraftFilesChange={setDraftFiles}
            onImmediateUpload={onImmediateUpload}
            onDeleteDocument={onDeleteDocument}
            isLoading={isDocumentsLoading}
            isUploading={isUploadingDocument}
            isDeleting={isDeletingDocument}
            canEdit={canAttach}
            emptyHint={
              onImmediateUpload
                ? "Upload phase documents. Files save immediately."
                : "Attach phase documents (optional). Draft files save when you create the phase."
            }
          />
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
