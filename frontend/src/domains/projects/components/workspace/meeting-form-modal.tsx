"use client";

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useForm,
  type DefaultValues,
  type Resolver,
} from "react-hook-form";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ProjectDatePicker } from "@/domains/projects/components/shared/project-date-picker";
import { useGetProjectTaskAssigneesQuery } from "@/domains/projects/api/projects.api";
import {
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
} from "../../api/meetings.api";
import type { Meeting } from "../../types/meetings.types";
import {
  combineScheduledAt,
  emptyMeetingFormValues,
  meetingFormSchema,
  splitScheduledAt,
  type MeetingFormValues,
} from "../../schemas/meeting/meeting.schema";

type MeetingFormModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  meeting?: Meeting | null;
};

const fieldErrorClass = "text-[11px] font-medium text-rose-600";

function toMeetingDefaults(
  meeting?: Meeting | null,
): DefaultValues<MeetingFormValues> {
  if (!meeting) return emptyMeetingFormValues();

  const { scheduledDate, scheduledTime } = splitScheduledAt(meeting.scheduledAt);
  const agendaItems =
    meeting.items
      ?.filter((item) => item.itemType === "Agenda")
      .map((item) => ({ content: item.content })) ?? [];
  const decisionItems =
    meeting.items
      ?.filter((item) => item.itemType === "Decision")
      .map((item) => ({ content: item.content })) ?? [];
  const actionItems =
    meeting.items
      ?.filter((item) => item.itemType === "Action")
      .map((item) => ({
        content: item.content,
        ownerId: item.ownerId ?? "",
      })) ?? [];

  return {
    title: meeting.title,
    scheduledDate,
    scheduledTime,
    attendeeIds: meeting.attendees?.map((attendee) => attendee.userId) ?? [],
    agenda: agendaItems.length ? agendaItems : [{ content: "" }],
    decisions: decisionItems.length ? decisionItems : [{ content: "" }],
    actions: actionItems.length
      ? actionItems
      : [{ content: "", ownerId: "" }],
  };
}

export function MeetingFormModal({
  open,
  onClose,
  projectId,
  meeting = null,
}: MeetingFormModalProps) {
  const isEdit = Boolean(meeting?.id);
  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(projectId, {
    skip: !open,
  });
  const [create, { isLoading: creating }] = useCreateMeetingMutation();
  const [update, { isLoading: updating }] = useUpdateMeetingMutation();
  const saving = creating || updating;

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MeetingFormValues>({
    resolver: zodResolver(
      meetingFormSchema,
    ) as Resolver<MeetingFormValues>,
    defaultValues: emptyMeetingFormValues(),
  });

  const agendaFields = useFieldArray({ control, name: "agenda" });
  const decisionFields = useFieldArray({ control, name: "decisions" });
  const actionFields = useFieldArray({ control, name: "actions" });
  const attendeeIds = watch("attendeeIds");

  useEffect(() => {
    if (!open) return;
    reset(toMeetingDefaults(meeting));
  }, [open, meeting, reset]);

  const toggleAttendee = (userId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...attendeeIds, userId])]
      : attendeeIds.filter((id) => id !== userId);
    setValue("attendeeIds", next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: MeetingFormValues) => {
    try {
      const scheduledAt = combineScheduledAt(
        values.scheduledDate,
        values.scheduledTime,
      ).toISOString();
      const body = {
        title: values.title.trim(),
        scheduledAt,
        attendeeIds: values.attendeeIds,
        items: [
          ...values.agenda
            .filter((item) => item.content.trim())
            .map((item) => ({
              itemType: "Agenda" as const,
              content: item.content.trim(),
            })),
          ...values.decisions
            .filter((item) => item.content.trim())
            .map((item) => ({
              itemType: "Decision" as const,
              content: item.content.trim(),
            })),
          ...values.actions
            .filter((item) => item.content.trim())
            .map((item) => ({
              itemType: "Action" as const,
              content: item.content.trim(),
              ownerId: item.ownerId,
            })),
        ],
      };

      if (isEdit && meeting) {
        await update({
          projectId,
          meetingId: meeting.id,
          body,
        }).unwrap();
      } else {
        await create({ projectId, body }).unwrap();
      }
      toast.success(isEdit ? "Meeting updated" : "Meeting created");
      onClose();
    } catch {
      toast.error("Could not save meeting");
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                {isEdit ? "Edit meeting" : "Create meeting"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                {isEdit
                  ? "Update attendees, agenda, decisions, and action points."
                  : "Schedule a meeting with attendees, agenda, decisions, and actions."}
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            id="meeting-form-modal"
            onSubmit={handleSubmit(onSubmit)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Title</Label>
              <Input
                id="meeting-title"
                placeholder="Meeting title"
                className="h-10"
                aria-invalid={Boolean(errors.title)}
                {...register("title")}
              />
              {errors.title && (
                <p className={fieldErrorClass}>{errors.title.message}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Scheduled date</Label>
                <Controller
                  control={control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <ProjectDatePicker
                      value={field.value}
                      onChange={(date) => field.onChange(date)}
                      minDate={new Date(2000, 0, 1)}
                      placeholder="Pick a date"
                      className="h-10"
                      invalid={Boolean(errors.scheduledDate)}
                    />
                  )}
                />
                {errors.scheduledDate && (
                  <p className={fieldErrorClass}>
                    {errors.scheduledDate.message as string}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-time">Scheduled time</Label>
                <Input
                  id="meeting-time"
                  type="time"
                  className="h-10"
                  aria-invalid={Boolean(errors.scheduledTime)}
                  {...register("scheduledTime")}
                />
                {errors.scheduledTime && (
                  <p className={fieldErrorClass}>
                    {errors.scheduledTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Attendees</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                {assignees.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No project assignees available.
                  </p>
                ) : (
                  assignees.map((assignee) => {
                    const checked = attendeeIds.includes(assignee.userId);
                    return (
                      <label
                        key={assignee.userId}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleAttendee(assignee.userId, value === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {assignee.displayName}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {assignee.email}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Agenda</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => agendaFields.append({ content: "" })}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              {agendaFields.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    className="h-9 flex-1"
                    placeholder="Agenda item"
                    {...register(`agenda.${index}.content`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => agendaFields.remove(index)}
                    disabled={agendaFields.fields.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Decisions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => decisionFields.append({ content: "" })}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              {decisionFields.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    className="h-9 flex-1"
                    placeholder="Decision item"
                    {...register(`decisions.${index}.content`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => decisionFields.remove(index)}
                    disabled={decisionFields.fields.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Action points</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    actionFields.append({ content: "", ownerId: "" })
                  }
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              {actionFields.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="space-y-2 rounded-lg border border-border/50 p-3"
                >
                  <Input
                    className="h-9"
                    placeholder="Action point"
                    {...register(`actions.${index}.content`)}
                  />
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <select
                        className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                        aria-invalid={Boolean(
                          errors.actions?.[index]?.ownerId,
                        )}
                        {...register(`actions.${index}.ownerId`)}
                      >
                        <option value="">Select owner</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.userId} value={assignee.userId}>
                            {assignee.displayName}
                          </option>
                        ))}
                      </select>
                      {errors.actions?.[index]?.ownerId && (
                        <p className={fieldErrorClass}>
                          {errors.actions[index]?.ownerId?.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => actionFields.remove(index)}
                      disabled={actionFields.fields.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </form>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="meeting-form-modal" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-1 size-4" />
              )}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
