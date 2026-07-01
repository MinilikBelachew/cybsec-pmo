"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { formatIntegerWithCommas } from "@/domains/projects/utils/format-budget";

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
  const [text, setText] = useState(() => formatIntegerWithCommas(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(formatIntegerWithCommas(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      name={name}
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        setText(formatIntegerWithCommas(value));
        onBlur?.();
      }}
      onChange={(event) => {
        const raw = event.target.value;
        const digits = raw.replace(/[^\d]/g, "");

        if (!digits) {
          setText("");
          onChange(undefined);
          return;
        }

        const parsed = Number(digits);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return;
        }

        setText(formatIntegerWithCommas(parsed));
        onChange(parsed);
      }}
      onKeyDown={(event) => {
        if (event.key === "-" || event.key === "+" || event.key === "e" || event.key === "E") {
          event.preventDefault();
        }
      }}
      className={cn(
        "w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium",
        className,
      )}
    />
  );
}
