"use client";

import React, { useMemo } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { milestoneSchema, type MilestoneFormValues } from "../../schemas/milestone/milestone.schema";
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

interface MilestoneFormProps {
  initialValues: MilestoneFormValues;
  phases: ProjectPhase[];
  onSubmit: (values: MilestoneFormValues, draftFiles: File[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
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

export function MilestoneForm({
  initialValues,
  phases,
  onSubmit,
  onCancel,
  isSaving,
  projectStartDate,
  projectEndDate,
  documents = [],
  isDocumentsLoading = false,
  onDeleteDocument,
  onImmediateUpload,
  isUploadingDocument = false,
  isDeletingDocument = false,
  canAttach = true,
}: MilestoneFormProps) {
  const [draftFiles, setDraftFiles] = React.useState<File[]>([]);

  const schema = useMemo(() => {
    return milestoneSchema
      .refine(
        (data) => {
          if (!projectStartDate || !data.targetDate) return true;
          const projStart = new Date(projectStartDate);
          const target = new Date(data.targetDate);
          projStart.setHours(0, 0, 0, 0);
          target.setHours(0, 0, 0, 0);
          return target >= projStart;
        },
        {
          message: projectStartDate 
            ? `Target date must be on or after project start date (${new Date(projectStartDate).toLocaleDateString()})` 
            : "Target date is before project start date",
          path: ["targetDate"],
        }
      )
      .refine(
        (data) => {
          if (!projectEndDate || !data.targetDate) return true;
          const projEnd = new Date(projectEndDate);
          const target = new Date(data.targetDate);
          projEnd.setHours(0, 0, 0, 0);
          target.setHours(0, 0, 0, 0);
          return target <= projEnd;
        },
        {
          message: projectEndDate 
            ? `Target date must be on or before project end date (${new Date(projectEndDate).toLocaleDateString()})` 
            : "Target date is after project end date",
          path: ["targetDate"],
        }
      );
  }, [projectStartDate, projectEndDate]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MilestoneFormValues>({
    resolver: zodResolver(schema) as Resolver<MilestoneFormValues>,
    defaultValues: initialValues,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values, draftFiles))}
      className="flex-1 flex flex-col justify-between overflow-hidden"
    >
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-6 py-4">
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
                        disabled={(date) => {
                          if (projectStartDate) {
                            const start = new Date(projectStartDate);
                            start.setHours(0, 0, 0, 0);
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            if (d < start) return true;
                          }
                          if (projectEndDate) {
                            const end = new Date(projectEndDate);
                            end.setHours(0, 0, 0, 0);
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            if (d > end) return true;
                          }
                          return false;
                        }}
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

            <Separator />

            <EntityAttachmentsSection
              title="Milestone files"
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
                  ? "Upload milestone documents. Files save immediately."
                  : "Attach milestone documents (optional). Draft files save when you create the milestone."
              }
            />
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
