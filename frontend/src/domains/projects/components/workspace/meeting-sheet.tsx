"use client";
import { Spinner } from "@/shared/components/spinner";

import { useEffect, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Eye, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { ProjectDatePicker } from "@/domains/projects/components/shared/project-date-picker";
import { useGetProjectTaskAssigneesQuery } from "@/domains/projects/api/projects.api";
import {
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
} from "../../api/meetings.api";
import type { Meeting } from "../../types/meetings.types";
import { MEETING_TYPES } from "../../types/meetings.types";
import {
  combineScheduledAt,
  emptyMeetingFormValues,
  meetingFormSchema,
  splitScheduledAt,
  type MeetingFormValues,
} from "../../schemas/meeting/meeting.schema";

export type MeetingSheetMode = "create" | "edit" | "preview";

type MeetingSheetProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  mode: MeetingSheetMode;
  meeting?: Meeting | null;
  canEdit?: boolean;
  onEdit?: (meeting: Meeting) => void;
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
    meetingType: meeting.meetingType ?? "",
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

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MeetingPreview({
  meeting,
  ownerNameById,
}: {
  meeting: Meeting;
  ownerNameById: Map<string, string>;
}) {
  const agenda =
    meeting.items?.filter((item) => item.itemType === "Agenda") ?? [];
  const decisions =
    meeting.items?.filter((item) => item.itemType === "Decision") ?? [];
  const actions =
    meeting.items?.filter((item) => item.itemType === "Action") ?? [];
  const attendees = meeting.attendees ?? [];

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <PreviewSection title="Details">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-base font-semibold text-foreground">
            {meeting.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {meeting.meetingType ? `${meeting.meetingType} · ` : ""}
            {new Date(meeting.scheduledAt).toLocaleString()} · {meeting.status}
          </p>
          {meeting.organiser?.displayName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Organised by {meeting.organiser.displayName}
            </p>
          ) : null}
        </div>
      </PreviewSection>

      <PreviewSection title="Attendees">
        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendees.</p>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60">
            {attendees.map((attendee) => (
              <li key={attendee.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium">
                  {attendee.user?.displayName ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {attendee.user?.email}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PreviewSection>

      <PreviewSection title="Agenda">
        {agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agenda items.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {agenda.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        )}
      </PreviewSection>

      <PreviewSection title="Decisions">
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {decisions.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        )}
      </PreviewSection>

      <PreviewSection title="Action points">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action points.</p>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60">
            {actions.map((item) => (
              <li key={item.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium">{item.content}</p>
                <p className="text-xs text-muted-foreground">
                  Owner:{" "}
                  {item.ownerId
                    ? (ownerNameById.get(item.ownerId) ?? "Assigned")
                    : "Unassigned"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PreviewSection>
    </div>
  );
}

export function MeetingSheet({
  open,
  onClose,
  projectId,
  mode,
  meeting = null,
  canEdit = false,
  onEdit,
}: MeetingSheetProps) {
  const isPreview = mode === "preview";
  const isEdit = mode === "edit";
  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(projectId, {
    skip: !open,
  });
  const [create, { isLoading: creating }] = useCreateMeetingMutation();
  const [update, { isLoading: updating }] = useUpdateMeetingMutation();
  const saving = creating || updating;

  const ownerNameById = new Map(
    assignees.map((assignee) => [assignee.userId, assignee.displayName]),
  );
  for (const attendee of meeting?.attendees ?? []) {
    if (attendee.userId && attendee.user?.displayName) {
      ownerNameById.set(attendee.userId, attendee.user.displayName);
    }
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema) as Resolver<MeetingFormValues>,
    defaultValues: emptyMeetingFormValues(),
  });

  const agendaFields = useFieldArray({ control, name: "agenda" });
  const decisionFields = useFieldArray({ control, name: "decisions" });
  const actionFields = useFieldArray({ control, name: "actions" });
  const attendeeIds = watch("attendeeIds") ?? [];

  useEffect(() => {
    if (!open || isPreview) return;
    reset(toMeetingDefaults(meeting));
  }, [open, meeting, reset, isPreview]);

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
        meetingType: values.meetingType.trim(),
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

  const title =
    mode === "preview"
      ? "Meeting details"
      : mode === "edit"
        ? "Edit meeting"
        : "Create meeting";

  const description =
    mode === "preview"
      ? "Review attendees, agenda, decisions, and action points."
      : mode === "edit"
        ? "Update attendees, agenda, decisions, and action points."
        : "Schedule a meeting with attendees, agenda, decisions, and actions.";

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col gap-0 p-0 sm:!max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2">
            {mode === "preview" ? (
              <Eye className="size-4 text-primary" />
            ) : mode === "edit" ? (
              <Pencil className="size-4 text-primary" />
            ) : (
              <CalendarPlus className="size-4 text-primary" />
            )}
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {isPreview && meeting ? (
          <MeetingPreview meeting={meeting} ownerNameById={ownerNameById} />
        ) : (
          <form
            id="meeting-form-sheet"
            onSubmit={handleSubmit(onSubmit)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
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

            <div className="space-y-1.5">
              <Label htmlFor="meeting-type">Meeting type</Label>
              <select
                id="meeting-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-invalid={Boolean(errors.meetingType)}
                {...register("meetingType")}
              >
                <option value="">Select meeting type</option>
                {MEETING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.meetingType && (
                <p className={fieldErrorClass}>{errors.meetingType.message}</p>
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
        )}

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border px-6 py-4">
          {isPreview ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              {canEdit && meeting && onEdit ? (
                <Button
                  type="button"
                  onClick={() => {
                    // Defer mode switch so this click does not land on the
                    // submit button that replaces Edit in the same slot.
                    const nextMeeting = meeting;
                    window.setTimeout(() => onEdit(nextMeeting), 0);
                  }}
                >
                  <Pencil className="mr-1 size-4" />
                  Edit
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                key={`meeting-submit-${mode}`}
                type="submit"
                form="meeting-form-sheet"
                disabled={saving}
              >
                {saving ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <CalendarPlus className="mr-1 size-4" />
                )}
                {isEdit ? "Update" : "Create"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
