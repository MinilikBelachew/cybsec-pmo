"use client";

import { useState } from "react";
import {
  CheckCheck,
  ChevronDown,
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
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import {
  downloadMomExport,
  useAcknowledgeMomMutation,
  useDeleteMeetingMutation,
  useDeleteMomMutation,
  useDistributeMomMutation,
  useGenerateMomMutation,
  useGetMeetingsQuery,
  useGetMomsQuery,
  useReviewMomMutation,
} from "../../api/meetings.api";
import type { Meeting, MomDocument } from "../../types/meetings.types";
import {
  MeetingSheet,
  type MeetingSheetMode,
} from "./meeting-sheet";

const MOM_STATUS_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Reviewed: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Distributed: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

function momStatusBadgeClass(status: string) {
  return (
    MOM_STATUS_BADGE[status] ??
    "bg-muted text-muted-foreground ring-1 ring-border"
  );
}

export function MeetingsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<MeetingSheetMode>("create");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
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
  const [review, { isLoading: reviewing }] = useReviewMomMutation();
  const [distribute, { isLoading: distributing }] = useDistributeMomMutation();
  const [acknowledge, { isLoading: acknowledging }] =
    useAcknowledgeMomMutation();

  const openCreate = () => {
    setActiveMeeting(null);
    setSheetMode("create");
    setSheetOpen(true);
  };

  const openPreview = (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setSheetMode("preview");
    setSheetOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setSheetMode("edit");
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setActiveMeeting(null);
    setSheetMode("create");
  };

  const act = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("Action failed");
    }
  };

  const onMomFlowAction = async (mom: MomDocument) => {
    setActionId(mom.id);
    try {
      if (mom.status === "Draft") {
        await review({ projectId, momId: mom.id }).unwrap();
        toast.success("MoM reviewed");
      } else if (mom.status === "Reviewed") {
        await distribute({ projectId, momId: mom.id }).unwrap();
        toast.success("MoM distributed");
      } else if (mom.status === "Distributed") {
        await acknowledge({ projectId, momId: mom.id }).unwrap();
        toast.success("MoM acknowledged");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActionId(null);
    }
  };

  const onDownload = async (momId: string, format: "pdf" | "docx") => {
    setExportingId(momId);
    try {
      await downloadMomExport(projectId, momId, format);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingId(null);
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
        if (activeMeeting?.id === deleteConfirm.id) closeSheet();
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
                  <li key={meeting.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openPreview(meeting)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openPreview(meeting);
                        }
                      }}
                      className="group flex cursor-pointer flex-col gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                          {meeting.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(meeting.scheduledAt).toLocaleString()} ·{" "}
                          {meeting.status}
                        </p>
                      </div>
                      {canEdit && (
                        <div
                          className="flex flex-wrap items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
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
                    </div>
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
                {moms.map((mom) => {
                  const isFlowBusy =
                    actionId === mom.id &&
                    (reviewing || distributing || acknowledging);
                  const showReview = canEdit && mom.status === "Draft";
                  const showDistribute = canEdit && mom.status === "Reviewed";
                  const showAcknowledge = mom.status === "Distributed";

                  return (
                    <li
                      key={mom.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {mom.meeting?.title ?? "Untitled meeting"}
                          </p>
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                            v{mom.version}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                              momStatusBadgeClass(mom.status),
                            )}
                          >
                            {mom.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(mom.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {showReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isFlowBusy}
                            onClick={() => void onMomFlowAction(mom)}
                          >
                            {isFlowBusy ? (
                              <Loader2 className="mr-1 size-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="mr-1 size-4" />
                            )}
                            Review
                          </Button>
                        )}
                        {showDistribute && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isFlowBusy}
                            onClick={() => void onMomFlowAction(mom)}
                          >
                            {isFlowBusy ? (
                              <Loader2 className="mr-1 size-4 animate-spin" />
                            ) : (
                              <Send className="mr-1 size-4" />
                            )}
                            Distribute
                          </Button>
                        )}
                        {showAcknowledge && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isFlowBusy}
                            onClick={() => void onMomFlowAction(mom)}
                          >
                            {isFlowBusy ? (
                              <Loader2 className="mr-1 size-4 animate-spin" />
                            ) : (
                              <CheckCheck className="mr-1 size-4" />
                            )}
                            Acknowledge
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={exportingId === mom.id}
                                className="gap-1"
                              />
                            }
                          >
                            {exportingId === mom.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            Export
                            <ChevronDown className="size-3.5 opacity-60" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => void onDownload(mom.id, "pdf")}
                            >
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void onDownload(mom.id, "docx")}
                            >
                              DOCX
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

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
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <MeetingSheet
        open={sheetOpen}
        onClose={closeSheet}
        projectId={projectId}
        mode={sheetMode}
        meeting={activeMeeting}
        canEdit={canEdit}
        onEdit={openEdit}
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
