"use client";

import { cn } from "@/shared/utils/cn";
import {
  formatIntegerWithCommas,
  parseIntegerInput,
} from "@/domains/projects/utils/format-budget";

interface BudgetValueInputProps {
  value?: number | null;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function BudgetValueInput({
  value,
  onChange,
  onBlur,
  name,
  placeholder = "e.g. 12,000",
  className,
  disabled = false,
}: BudgetValueInputProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      name={name}
      disabled={disabled}
      placeholder={placeholder}
      value={formatIntegerWithCommas(value)}
      onChange={(event) => onChange(parseIntegerInput(event.target.value))}
      onBlur={onBlur}
      className={cn(
        "w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium",
        className,
      )}
    />
  );
}
