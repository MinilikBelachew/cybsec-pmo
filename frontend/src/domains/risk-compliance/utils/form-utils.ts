export function toApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { message?: string | string[] } }).data;
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (Array.isArray(data?.message) && data.message[0]) {
      return String(data.message[0]);
    }
  }
  return fallback;
}

export function scoreBadgeClass(score: number) {
  if (score >= 12) return "bg-rose-100 text-rose-800 border-rose-200";
  if (score >= 6) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export function priorityBadgeClass(priority: string) {
  if (priority === "Critical" || priority === "High") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (priority === "Medium") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function issueStatusBadgeClass(status: string) {
  if (status === "Closed" || status === "Resolved") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "In Progress") {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (status === "Cancelled") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function assigneeLabel(assignee?: {
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
} | null): string | undefined {
  if (!assignee) return undefined;
  return assignee.displayName || assignee.name || assignee.email || undefined;
}
