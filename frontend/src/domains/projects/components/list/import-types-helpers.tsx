import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Department, Customer, ProjectManager } from "../../types/projects.types";
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUSES,
  getProjectStatusLabel,
} from "../../utils/project-status";

export const STATUS_CONFIG = PROJECT_STATUS_CONFIG;

export const PRIORITY_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  Critical: { label: "Critical", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", dot: "bg-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

export const TASK_STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  To_Do: {
    label: "To Do",
    dot: "border-2 border-slate-400 dark:border-white/30 bg-transparent",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    border: "border-slate-200 dark:border-slate-800",
  },
  In_Progress: {
    label: "In Progress",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  Submitted_for_Review: {
    label: "Submitted for Review",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  Approved: {
    label: "Approved",
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-200 dark:border-teal-800",
  },
  Rework: {
    label: "Rework",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  Done: {
    label: "Done",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

export const isEngagementValid = (val: string) => ["ManagedServices", "StaffAugmentation", "FixedPrice"].includes(val);
export const isBillingValid = (val: string) => ["TimeAndMaterial", "FixedPrice", "Retainer"].includes(val);
export const isPriorityValid = (val: string) => ["Low", "Medium", "High", "Critical"].includes(val);
export const isCurrencyValid = (val: string) => ["USD", "EUR", "AED", "SAR"].includes(val);
export const isStatusValid = (val: string) => PROJECT_STATUSES.includes(val as (typeof PROJECT_STATUSES)[number]);
export const isTaskStatusValid = (val: string) => ["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"].includes(val);
export const isPhaseStatusValid = (val: string) => ["Planned", "Active", "Completed", "On_Hold"].includes(val);
export const isMilestoneStatusValid = (val: string) => ["Pending", "Completed", "Missed"].includes(val);

export const formatBudget = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch (e) {
    return `${currency || "USD"} ${(value || 0).toLocaleString()}`;
  }
};

export const ENGAGEMENT_OPTIONS = [
  { value: "ManagedServices", label: "Managed Services" },
  { value: "StaffAugmentation", label: "Staff Augmentation" },
  { value: "FixedPrice", label: "Fixed Price" },
];

export const BILLING_OPTIONS = [
  { value: "TimeAndMaterial", label: "Time & Material" },
  { value: "FixedPrice", label: "Fixed Price" },
  { value: "Retainer", label: "Retainer" },
];

export const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "AED", label: "AED" },
  { value: "SAR", label: "SAR" },
];

export const STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({
  value,
  label: getProjectStatusLabel(value),
}));

export const TASK_STATUS_OPTIONS = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

export const PHASE_STATUS_OPTIONS = [
  { value: "Planned", label: "Planned" },
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "On_Hold", label: "On Hold" },
];

export const MILESTONE_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
  { value: "Missed", label: "Missed" },
];

interface EnumSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function EnumSelect({ value, options, onChange, placeholder = "Select...", className }: EnumSelectProps) {
  const isValInOpts = options.some((o) => o.value === value);
  return (
    <div className={cn("relative flex items-center w-fit bg-transparent", className)}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 outline-none ring-0 appearance-none pr-5 text-xs font-semibold cursor-pointer text-foreground focus:ring-0 focus:outline-none"
      >
        {(!value || !isValInOpts) && (
          <option value={value || ""} disabled className="bg-background text-rose-500 font-bold">
            {value || placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-background text-foreground font-semibold">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}
