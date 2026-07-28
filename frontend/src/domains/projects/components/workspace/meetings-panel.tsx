"use client";

import { useState } from "react";
import {
  CalendarPlus,
  CheckCheck,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { useGetProjectTaskAssigneesQuery } from "@/domains/projects/api/projects.api";
import {
  useAcknowledgeMomMutation,
  useCreateMeetingMutation,
  useDistributeMomMutation,
  useGenerateMomMutation,
  useGetMeetingsQuery,
  useGetMomsQuery,
  useLazyExportMomQuery,
  useReviewMomMutation,
  useUpdateMeetingMutation,
} from "../../api/meetings.api";
import type { Meeting } from "../../types/meetings.types";

export function MeetingsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<string[]>([""]);
  const [decisions, setDecisions] = useState<string[]>([""]);
  const [actions, setActions] = useState<
    Array<{ content: string; ownerId: string }>
  >([{ content: "", ownerId: "" }]);
  const { data: meetings = [], isLoading } = useGetMeetingsQuery(projectId);
  const { data: moms = [] } = useGetMomsQuery(projectId);
  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(projectId);
  const [create, { isLoading: creating }] = useCreateMeetingMutation();
  const [update, { isLoading: updating }] = useUpdateMeetingMutation();
  const [generate] = useGenerateMomMutation();
  const [review] = useReviewMomMutation();
  const [distribute] = useDistributeMomMutation();
  const [acknowledge] = useAcknowledgeMomMutation();
  const [exportMom] = useLazyExportMomQuery();

  const resetForm = () => {
    setTitle("");
    setScheduledAt("");
    setAttendeeIds([]);
    setAgenda([""]);
    setDecisions([""]);
    setActions([{ content: "", ownerId: "" }]);
    setEditingId(null);
    setShowForm(false);
  };

  const editMeeting = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setTitle(meeting.title);
    setScheduledAt(new Date(meeting.scheduledAt).toISOString().slice(0, 16));
    setAttendeeIds(meeting.attendees?.map((attendee) => attendee.userId) ?? []);
    const agendaItems =
      meeting.items
        ?.filter((item) => item.itemType === "Agenda")
        .map((item) => item.content) ?? [];
    const decisionItems =
      meeting.items
        ?.filter((item) => item.itemType === "Decision")
        .map((item) => item.content) ?? [];
    const actionItems =
      meeting.items
        ?.filter((item) => item.itemType === "Action")
        .map((item) => ({
          content: item.content,
          ownerId: item.ownerId ?? "",
        })) ?? [];
    setAgenda(agendaItems.length ? agendaItems : [""]);
    setDecisions(decisionItems.length ? decisionItems : [""]);
    setActions(
      actionItems.length ? actionItems : [{ content: "", ownerId: "" }],
    );
    setShowForm(true);
  };

  const act = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("Action failed");
    }
  };

  const onDownload = async (momId: string, format: "pdf" | "docx") => {
    try {
      const blob = await exportMom({ projectId, momId, format }).unwrap();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mom-${momId}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Meetings &amp; MoM</h2>
          <p className="text-xs text-muted-foreground">
            Schedule meetings and export interim CyberSec sample MoM packs
            (PDF/DOCX).
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          >
            <Plus className="mr-1 size-4" />
            Meeting
          </Button>
        )}
      </div>

      {showForm && (
        <form
          className="space-y-4 rounded-xl border bg-card p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const body = {
                title,
                scheduledAt: new Date(scheduledAt).toISOString(),
                attendeeIds,
                items: [
                  ...agenda
                    .filter(Boolean)
                    .map((content) => ({
                      itemType: "Agenda" as const,
                      content,
                    })),
                  ...decisions
                    .filter(Boolean)
                    .map((content) => ({
                      itemType: "Decision" as const,
                      content,
                    })),
                  ...actions
                    .filter((item) => item.content)
                    .map((item) => ({
                      itemType: "Action" as const,
                      content: item.content,
                      ...(item.ownerId ? { ownerId: item.ownerId } : {}),
                    })),
                ],
              };
              if (editingId) {
                await update({
                  projectId,
                  meetingId: editingId,
                  body,
                }).unwrap();
              } else {
                await create({ projectId, body }).unwrap();
              }
              resetForm();
              toast.success(editingId ? "Meeting updated" : "Meeting created");
            } catch {
              toast.error("Could not save meeting");
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Meeting title"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            />
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Attendees</span>
            <select
              multiple
              value={attendeeIds}
              onChange={(e) =>
                setAttendeeIds(
                  Array.from(
                    e.target.selectedOptions,
                    (option) => option.value,
                  ),
                )
              }
              className="min-h-24 w-full rounded-lg border bg-background p-2"
            >
              {assignees.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.displayName} · {assignee.email}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["Agenda", agenda, setAgenda],
              ["Decisions", decisions, setDecisions],
            ] as const
          ).map(([label, values, setter]) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setter([...values, ""])}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              {values.map((value, index) => (
                <div key={`${label}-${index}`} className="flex gap-2">
                  <input
                    value={value}
                    onChange={(e) =>
                      setter(
                        values.map((item, itemIndex) =>
                          itemIndex === index ? e.target.value : item,
                        ),
                      )
                    }
                    className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm"
                    placeholder={`${label} item`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setter(
                        values.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Action points</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setActions([...actions, { content: "", ownerId: "" }])
                }
              >
                <Plus className="size-3" />
              </Button>
            </div>
            {actions.map((action, index) => (
              <div
                key={`action-${index}`}
                className="grid gap-2 md:grid-cols-[1fr_220px_auto]"
              >
                <input
                  value={action.content}
                  onChange={(e) =>
                    setActions(
                      actions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, content: e.target.value }
                          : item,
                      ),
                    )
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  placeholder="Action point"
                />
                <select
                  value={action.ownerId}
                  onChange={(e) =>
                    setActions(
                      actions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, ownerId: e.target.value }
                          : item,
                      ),
                    )
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">No owner</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.userId} value={assignee.userId}>
                      {assignee.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setActions(
                      actions.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating}>
              {creating || updating ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-1 size-4" />
              )}
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b px-4 py-3 text-sm font-bold">Meetings</h3>
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : meetings.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No meetings yet.
            </p>
          ) : (
            <div className="divide-y">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(meeting.scheduledAt).toLocaleString()} ·{" "}
                      {meeting.status}
                    </p>
                  </div>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editMeeting(meeting)}
                      >
                        <Pencil className="mr-1 size-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void act(
                            () =>
                              generate({
                                projectId,
                                meetingId: meeting.id,
                              }).unwrap(),
                            "MoM generated",
                          )
                        }
                      >
                        <FileText className="mr-1 size-4" />
                        Generate MoM
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b px-4 py-3 text-sm font-bold">
            Minutes of Meeting
          </h3>
          {moms.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No minutes generated yet.
            </p>
          ) : (
            <div className="divide-y">
              {moms.map((mom) => (
                <div key={mom.id} className="space-y-3 p-4">
                  <div>
                    <p className="font-semibold">
                      {mom.meeting?.title ?? `MoM v${mom.version}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mom.status} · {new Date(mom.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canEdit && mom.status === "Draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void act(
                            () => review({ projectId, momId: mom.id }).unwrap(),
                            "MoM reviewed",
                          )
                        }
                      >
                        <ShieldCheck className="mr-1 size-4" />
                        Review
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mom.status !== "Reviewed"}
                        onClick={() =>
                          void act(
                            () =>
                              distribute({ projectId, momId: mom.id }).unwrap(),
                            "MoM distributed",
                          )
                        }
                      >
                        <Send className="mr-1 size-4" />
                        Distribute
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void act(
                          () =>
                            acknowledge({
                              projectId,
                              momId: mom.id,
                            }).unwrap(),
                          "MoM acknowledged",
                        )
                      }
                    >
                      <CheckCheck className="mr-1 size-4" />
                      Acknowledge
                    </Button>
                    {(["pdf", "docx"] as const).map((format) => (
                      <Button
                        key={format}
                        variant="outline"
                        size="sm"
                        onClick={() => void onDownload(mom.id, format)}
                      >
                        <Download className="mr-1 size-4" />
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
