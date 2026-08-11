"use client";
import { Spinner } from "@/shared/components/spinner";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, ChevronDown, Download, FileText, Pencil, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/domains/auth";
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

type MeetingGroup = {
  key: string;
  meeting: Meeting | null;
  title: string;
  scheduledAt?: string;
  status?: string;
  moms: MomDocument[];
};

const EMPTY_MEETINGS: Meeting[] = [];
const EMPTY_MOMS: MomDocument[] = [];

export function MeetingsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const isEngineer = user?.backendRoleCode === "engineer";
  const canManageMeetings = canEdit && !isEngineer;

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
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);
  const userCollapsedMeeting = useRef(false);
  const [openAckMomIds, setOpenAckMomIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { data: meetingsData, isLoading } = useGetMeetingsQuery(projectId, {
    skip: isEngineer,
  });
  const { data: momsData, isLoading: momsLoading } =
    useGetMomsQuery(projectId);
  const meetings = meetingsData ?? EMPTY_MEETINGS;
  const moms = momsData ?? EMPTY_MOMS;
  const [deleteMeeting, { isLoading: deletingMeeting }] =
    useDeleteMeetingMutation();
  const [deleteMom, { isLoading: deletingMom }] = useDeleteMomMutation();
  const [generate] = useGenerateMomMutation();
  const [review, { isLoading: reviewing }] = useReviewMomMutation();
  const [distribute, { isLoading: distributing }] = useDistributeMomMutation();
  const [acknowledge, { isLoading: acknowledging }] =
    useAcknowledgeMomMutation();

  const groups = useMemo<MeetingGroup[]>(() => {
    const momsByMeeting = new Map<string, MomDocument[]>();
    for (const mom of moms) {
      const key = mom.meetingId;
      const list = momsByMeeting.get(key) ?? [];
      list.push(mom);
      momsByMeeting.set(key, list);
    }
    for (const list of momsByMeeting.values()) {
      list.sort((a, b) => b.version - a.version);
    }

    const sortByLatest = (a: MeetingGroup, b: MeetingGroup) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    };

    if (isEngineer) {
      return [...momsByMeeting.entries()]
        .map(([meetingId, meetingMoms]) => {
          const first = meetingMoms[0];
          return {
            key: meetingId,
            meeting: null,
            title: first?.meeting?.title ?? "Untitled meeting",
            scheduledAt: first?.meeting?.scheduledAt,
            moms: meetingMoms,
          };
        })
        .sort(sortByLatest);
    }

    return meetings
      .map((meeting) => ({
        key: meeting.id,
        meeting,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt,
        status: meeting.status,
        moms: momsByMeeting.get(meeting.id) ?? [],
      }))
      .sort(sortByLatest);
  }, [isEngineer, meetings, moms]);

  useEffect(() => {
    userCollapsedMeeting.current = false;
    setOpenMeetingId(null);
  }, [projectId]);

  useEffect(() => {
    if (groups.length === 0) {
      setOpenMeetingId(null);
      return;
    }

    setOpenMeetingId((current) => {
      if (current && groups.some((group) => group.key === current)) {
        return current;
      }
      if (userCollapsedMeeting.current) return null;
      return groups[0]?.key ?? null;
    });
  }, [groups]);

  const toggleMeeting = (key: string) => {
    setOpenMeetingId((current) => {
      if (current === key) {
        userCollapsedMeeting.current = true;
        return null;
      }
      userCollapsedMeeting.current = false;
      return key;
    });
  };

  const toggleAckAccordion = (momId: string) => {
    setOpenAckMomIds((prev) => {
      const next = new Set(prev);
      if (next.has(momId)) next.delete(momId);
      else next.add(momId);
      return next;
    });
  };

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

  const hasAcknowledged = (mom: MomDocument) =>
    Boolean(
      user?.id &&
        mom.acknowledgements?.some(
          (ack) => ack.attendeeId === user.id && ack.acknowledged,
        ),
    );

  const loading = isEngineer ? momsLoading : isLoading || momsLoading;
  const emptyMessage = isEngineer
    ? "No distributed minutes for meetings you attended."
    : "No meetings yet.";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold">
            {isEngineer ? "Minutes of Meeting" : "Meetings & MoM"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isEngineer
              ? "Review and acknowledge distributed minutes for meetings you attended."
              : "Schedule meetings and manage minutes nested under each meeting."}
          </p>
        </div>
        {canManageMeetings && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Meeting
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
            <h3 className="text-sm font-bold">
              {isEngineer ? "Distributed to you" : "Meetings"}
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {groups.length}
            </span>
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : groups.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {groups.map((group) => {
                const isOpen = openMeetingId === group.key;
                return (
                  <li key={group.key} className="bg-card">
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => toggleMeeting(group.key)}
                        aria-expanded={isOpen}
                        className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                              {group.title}
                            </p>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {group.moms.length} MoM
                              {group.moms.length === 1 ? "" : "s"}
                            </span>
                            {!isEngineer && group.status && (
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                {group.status}
                              </span>
                            )}
                          </div>
                          {group.scheduledAt && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(group.scheduledAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
                        {!isEngineer && group.meeting && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreview(group.meeting!)}
                          >
                            View
                          </Button>
                        )}
                        {canManageMeetings && group.meeting && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(group.meeting!)}
                            >
                              <Pencil className="mr-1 size-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void act(async () => {
                                  await generate({
                                    projectId,
                                    meetingId: group.meeting!.id,
                                  }).unwrap();
                                  userCollapsedMeeting.current = false;
                                  setOpenMeetingId(group.key);
                                }, "MoM generated")
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
                                  id: group.meeting!.id,
                                  label: group.title,
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border/40 bg-muted/20 px-4 py-3 sm:pl-10">
                        {group.moms.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">
                            No minutes generated for this meeting yet.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {group.moms.map((mom) => {
                              const isFlowBusy =
                                actionId === mom.id &&
                                (reviewing ||
                                  distributing ||
                                  acknowledging);
                              const showReview =
                                canManageMeetings && mom.status === "Draft";
                              const showDistribute =
                                canManageMeetings &&
                                mom.status === "Reviewed";
                              const alreadyAcked = hasAcknowledged(mom);
                              const isAttendee = Boolean(
                                user?.id &&
                                  (mom.acknowledgements ?? []).some(
                                    (ack) => ack.attendeeId === user.id,
                                  ),
                              );
                              const showAcknowledge =
                                mom.status === "Distributed" && isAttendee;
                              const acknowledgements =
                                mom.acknowledgements ?? [];
                              const ackCount = acknowledgements.filter(
                                (ack) => ack.acknowledged,
                              ).length;

                              return (
                                <li
                                  key={mom.id}
                                  className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card px-3 py-2.5"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold">
                                          Minutes v{mom.version}
                                        </p>
                                        {!isEngineer && (
                                          <span
                                            className={cn(
                                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                                              momStatusBadgeClass(mom.status),
                                            )}
                                          >
                                            {mom.status}
                                          </span>
                                        )}
                                        {!isEngineer &&
                                          mom.status === "Distributed" &&
                                          acknowledgements.length > 0 && (
                                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                                              {ackCount}/
                                              {acknowledgements.length}{" "}
                                              acknowledged
                                            </span>
                                          )}
                                      </div>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {new Date(
                                          mom.createdAt,
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {showReview && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={isFlowBusy}
                                          onClick={() =>
                                            void onMomFlowAction(mom)
                                          }
                                        >
                                          {isFlowBusy ? (
                                            <Spinner size="sm" className="mr-1" />
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
                                          onClick={() =>
                                            void onMomFlowAction(mom)
                                          }
                                        >
                                          {isFlowBusy ? (
                                            <Spinner size="sm" className="mr-1" />
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
                                          disabled={
                                            isFlowBusy || alreadyAcked
                                          }
                                          onClick={() =>
                                            void onMomFlowAction(mom)
                                          }
                                        >
                                          {isFlowBusy ? (
                                            <Spinner size="sm" className="mr-1" />
                                          ) : (
                                            <CheckCheck className="mr-1 size-4" />
                                          )}
                                          {alreadyAcked
                                            ? "Acknowledged"
                                            : "Acknowledge"}
                                        </Button>
                                      )}

                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          render={
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={
                                                exportingId === mom.id
                                              }
                                              className="gap-1"
                                            />
                                          }
                                        >
                                          {exportingId === mom.id ? (
                                            <Spinner size="sm" />
                                          ) : (
                                            <Download className="size-4" />
                                          )}
                                          Export
                                          <ChevronDown className="size-3.5 opacity-60" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          className="w-36"
                                        >
                                          <DropdownMenuItem
                                            onClick={() =>
                                              void onDownload(mom.id, "pdf")
                                            }
                                          >
                                            PDF
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              void onDownload(mom.id, "docx")
                                            }
                                          >
                                            DOCX
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>

                                      {canManageMeetings && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-rose-600 hover:text-rose-700"
                                          onClick={() =>
                                            setDeleteConfirm({
                                              type: "mom",
                                              id: mom.id,
                                              label: `${group.title} v${mom.version}`,
                                            })
                                          }
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {canManageMeetings &&
                                    mom.status === "Distributed" &&
                                    acknowledgements.length > 0 && (
                                      <div className="overflow-hidden rounded-md border border-border/50 bg-muted/30">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleAckAccordion(mom.id)
                                          }
                                          aria-expanded={openAckMomIds.has(
                                            mom.id,
                                          )}
                                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                                        >
                                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Acknowledgements
                                          </span>
                                          <span className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                              {ackCount}/
                                              {acknowledgements.length}
                                            </span>
                                            <ChevronDown
                                              className={cn(
                                                "size-3.5 text-muted-foreground transition-transform",
                                                openAckMomIds.has(mom.id) &&
                                                  "rotate-180",
                                              )}
                                            />
                                          </span>
                                        </button>
                                        {openAckMomIds.has(mom.id) && (
                                          <ul className="max-h-56 space-y-1 overflow-y-auto border-t border-border/40 px-3 py-2">
                                            {acknowledgements.map((ack) => (
                                              <li
                                                key={ack.id}
                                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                              >
                                                <span className="font-medium">
                                                  {ack.attendee
                                                    ?.displayName ??
                                                    "Unknown attendee"}
                                                </span>
                                                <span
                                                  className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                                    ack.acknowledged
                                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
                                                  )}
                                                >
                                                  {ack.acknowledged
                                                    ? `Acknowledged${ack.ackedAt ? ` · ${new Date(ack.ackedAt).toLocaleString()}` : ""}`
                                                    : "Pending"}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {!isEngineer && (
        <MeetingSheet
          open={sheetOpen}
          onClose={closeSheet}
          projectId={projectId}
          mode={sheetMode}
          meeting={activeMeeting}
          canEdit={canManageMeetings}
          onEdit={openEdit}
        />
      )}

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
