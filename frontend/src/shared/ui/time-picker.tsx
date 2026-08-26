"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

function openNativeTimePicker(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  const withPicker = input as HTMLInputElement & { showPicker?: () => void };
  try {
    withPicker.showPicker?.();
  } catch {
    // Browser may block showPicker outside a direct gesture; focus still helps.
  }
}

export interface TimePickerProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  invalid?: boolean;
}

/**
 * shadcn-style time picker: Input + Clock affordance that opens the native picker.
 * `value` / `onChange` use `HH:mm` (24h).
 */
function TimePicker({
  className,
  value,
  onChange,
  invalid,
  disabled,
  id,
  ...props
}: TimePickerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={cn(
        "relative flex h-9 cursor-pointer items-center rounded-lg border border-input bg-transparent px-2.5 shadow-none transition-colors hover:border-border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        invalid &&
          "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
      onClick={() => {
        if (!disabled) openNativeTimePicker(inputRef.current);
      }}
    >
      <Clock
        className="pointer-events-none mr-2 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <Input
        {...props}
        id={id}
        ref={inputRef}
        type="time"
        step={60}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={(event) => {
          props.onFocus?.(event);
          openNativeTimePicker(event.currentTarget);
        }}
        onClick={(event) => {
          event.stopPropagation();
          props.onClick?.(event);
          openNativeTimePicker(event.currentTarget);
        }}
        className={cn(
          "h-auto flex-1 cursor-pointer border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
          "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        )}
      />
    </div>
  );
}

export { TimePicker };
