import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  ApprovalStatus,
  KekaSyncStatus,
  TimesheetEntryStatus,
  UtilizationStatus,
} from "../types/resources.types";

export const UTILIZATION_CONFIG: Record<
  UtilizationStatus,
  { label: string; text: string; bg: string; border: string; bar: string }
> = {
  over: {
    label: "Overloaded",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
    bar: "bg-rose-500",
  },
  optimal: {
    label: "Optimal",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    bar: "bg-emerald-500",
  },
  under: {
    label: "Underutilized",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    bar: "bg-amber-400",
  },
  available: {
    label: "Available",
    text: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-900/20",
    border: "border-sky-200 dark:border-sky-800",
    bar: "bg-sky-500",
  },
};

export const KEKA_SYNC_CONFIG: Record<
  KekaSyncStatus,
  { label: string; text: string; icon: LucideIcon }
> = {
  synced: { label: "Synced", text: "text-emerald-600", icon: CheckCircle2 },
  pending: { label: "Pending", text: "text-amber-600", icon: Clock },
  error: { label: "Error", text: "text-rose-600", icon: AlertCircle },
};

export const TIMESHEET_STATUS_CONFIG: Record<
  TimesheetEntryStatus,
  { label: string; text: string; bg: string; border: string; icon: LucideIcon }
> = {
  draft: {
    label: "Draft",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border/60",
    icon: Clock,
  },
  submitted: {
    label: "Submitted",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: Send,
  },
  approved: {
    label: "Approved",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
    icon: AlertCircle,
  },
};

export const APPROVAL_STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; text: string; bg: string; border: string; icon: LucideIcon }
> = {
  pending: {
    label: "Pending",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
    icon: X,
  },
};
