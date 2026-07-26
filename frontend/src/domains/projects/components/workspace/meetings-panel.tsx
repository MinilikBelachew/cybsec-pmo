"use client";

import { useState } from "react";
import { CalendarPlus, CheckCheck, FileText, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import {
  useAcknowledgeMomMutation,
  useCreateMeetingMutation,
  useGenerateMomMutation,
  useGetMeetingsQuery,
  useGetMomsQuery,
  useReviewMomMutation,
} from "../../api/meetings.api";

export function MeetingsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const { data: meetings = [], isLoading } = useGetMeetingsQuery(projectId);
  const { data: moms = [] } = useGetMomsQuery(projectId);
  const [create, { isLoading: creating }] = useCreateMeetingMutation();
  const [generate] = useGenerateMomMutation();
  const [review] = useReviewMomMutation();
  const [acknowledge] = useAcknowledgeMomMutation();
  const act = async (action: () => Promise<unknown>, success: string) => { try { await action(); toast.success(success); } catch { toast.error("Action failed"); } };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Meetings &amp; MoM</h2><p className="text-xs text-muted-foreground">Schedule project meetings and manage minutes through acknowledgement.</p></div>{canEdit && <Button size="sm" onClick={() => setShowForm((value) => !value)}><Plus className="mr-1 size-4" />Meeting</Button>}</div>
      {showForm && <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_220px_auto]" onSubmit={async (e) => { e.preventDefault(); try { await create({ projectId, body: { title, scheduledAt: new Date(scheduledAt).toISOString() } }).unwrap(); setTitle(""); setScheduledAt(""); setShowForm(false); toast.success("Meeting created"); } catch { toast.error("Could not create meeting"); } }}><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Meeting title" className="h-10 rounded-lg border bg-background px-3 text-sm" /><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="h-10 rounded-lg border bg-background px-3 text-sm" /><Button type="submit" disabled={creating}>{creating ? <Loader2 className="mr-1 size-4 animate-spin" /> : <CalendarPlus className="mr-1 size-4" />}Create</Button></form>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card"><h3 className="border-b px-4 py-3 text-sm font-bold">Meetings</h3>{isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p> : meetings.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No meetings yet.</p> : <div className="divide-y">{meetings.map((meeting) => <div key={meeting.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{meeting.title}</p><p className="text-xs text-muted-foreground">{new Date(meeting.scheduledAt).toLocaleString()} · {meeting.status}</p></div>{canEdit && <Button variant="outline" size="sm" onClick={() => void act(() => generate({ projectId, meetingId: meeting.id }).unwrap(), "MoM generated")}><FileText className="mr-1 size-4" />Generate MoM</Button>}</div>)}</div>}</section>
        <section className="overflow-hidden rounded-xl border bg-card"><h3 className="border-b px-4 py-3 text-sm font-bold">Minutes of Meeting</h3>{moms.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No minutes generated yet.</p> : <div className="divide-y">{moms.map((mom) => <div key={mom.id} className="space-y-3 p-4"><div><p className="font-semibold">{mom.meeting?.title ?? `MoM v${mom.version}`}</p><p className="text-xs text-muted-foreground">{mom.status} · {new Date(mom.createdAt).toLocaleString()}</p></div><div className="flex gap-2">{canEdit && mom.status === "Draft" && <Button variant="outline" size="sm" onClick={() => void act(() => review({ projectId, momId: mom.id }).unwrap(), "MoM reviewed")}><ShieldCheck className="mr-1 size-4" />Review</Button>}<Button variant="outline" size="sm" onClick={() => void act(() => acknowledge({ projectId, momId: mom.id }).unwrap(), "MoM acknowledged")}><CheckCheck className="mr-1 size-4" />Acknowledge</Button></div></div>)}</div>}</section>
      </div>
    </div>
  );
}
