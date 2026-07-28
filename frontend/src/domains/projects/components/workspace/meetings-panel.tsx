"use client";

import { useState } from "react";
import {
  CheckCheck,
  Download,
  FileText,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  useAcknowledgeMomMutation,
  useDeleteMeetingMutation,
  useDeleteMomMutation,
  useDistributeMomMutation,
  useGenerateMomMutation,
  useGetMeetingsQuery,
  useGetMomsQuery,
  useLazyExportMomQuery,
  useReviewMomMutation,
} from "../../api/meetings.api";
import type { Meeting } from "../../types/meetings.types";
import { MeetingFormModal } from "./meeting-form-modal";

export function MeetingsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "meeting" | "mom";
    id: string;
    label: string;
  } | null>(null);
  const { data: meetings = [], isLoading } = useGetMeetingsQuery(projectId);
  const { data: moms = [] } = useGetMomsQuery(projectId);
  const [deleteMeeting, { isLoading: deletingMeeting }] =
    useDeleteMeetingMutation();
  const [deleteMom, { isLoading: deletingMom }] = useDeleteMomMutation();
  const [generate] = useGenerateMomMutation();
  const [review] = useReviewMomMutation();
  const [distribute] = useDistributeMomMutation();
  const [acknowledge] = useAcknowledgeMomMutation();
  const [exportMom] = useLazyExportMomQuery();

  const openCreate = () => {
    setEditingMeeting(null);
    setFormOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingMeeting(null);
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

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "meeting") {
        await deleteMeeting({
          projectId,
          meetingId: deleteConfirm.id,
        }).unwrap();
        if (editingMeeting?.id === deleteConfirm.id) closeForm();
        toast.success("Meeting deleted");
      } else {
        await deleteMom({ projectId, momId: deleteConfirm.id }).unwrap();
        toast.success("MoM deleted");
      }
      setDeleteConfirm(null);
    } catch {
      toast.error("Could not delete");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold">Meetings &amp; MoM</h2>
          <p className="text-xs text-muted-foreground">
            Schedule meetings and export interim CyberSec sample MoM packs
            (PDF/DOCX).
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Meeting
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
              <h3 className="text-sm font-bold">Meetings</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {meetings.length}
              </span>
            </div>
            {isLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : meetings.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No meetings yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {meetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {meeting.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(meeting.scheduledAt).toLocaleString()} ·{" "}
                        {meeting.status}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(meeting)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "meeting",
                              id: meeting.id,
                              label: meeting.title,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
              <h3 className="text-sm font-bold">Minutes of Meeting</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {moms.length}
              </span>
            </div>
            {moms.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No minutes generated yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {moms.map((mom) => (
                  <li
                    key={mom.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {mom.meeting?.title ?? "Untitled meeting"}
                        </p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          v{mom.version}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          {mom.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(mom.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && mom.status === "Draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void act(
                              () =>
                                review({
                                  projectId,
                                  momId: mom.id,
                                }).unwrap(),
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
                                distribute({
                                  projectId,
                                  momId: mom.id,
                                }).unwrap(),
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
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "mom",
                              id: mom.id,
                              label: `${mom.meeting?.title ?? "MoM"} v${mom.version}`,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <MeetingFormModal
        open={formOpen}
        onClose={closeForm}
        projectId={projectId}
        meeting={editingMeeting}
      />

      <DeleteDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void onConfirmDelete()}
        title={
          deleteConfirm?.type === "mom"
            ? "Delete minutes of meeting" 
            : "Delete meeting"
        }
        description={
          deleteConfirm?.type === "meeting"
            ? `Are you sure you want to delete "${deleteConfirm.label}"? Related MoM documents will also be removed. This cannot be undone.`
            : deleteConfirm
              ? `Are you sure you want to delete "${deleteConfirm.label}"? This cannot be undone.`
              : "Are you sure you want to delete this item?"
        }
        isDeleting={deletingMeeting || deletingMom}
      />
    </div>
  );
}
