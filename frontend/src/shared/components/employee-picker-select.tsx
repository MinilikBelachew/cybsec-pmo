"use client";

import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";

export type EmployeePickerOption = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  subtitle?: string;
};

type EmployeePickerSelectProps = {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: EmployeePickerOption[];
  placeholder?: string;
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

const NONE_VALUE = "__none__";

export function EmployeePickerSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select employee",
  noneLabel = "No backup",
  disabled = false,
  className,
  triggerClassName,
}: EmployeePickerSelectProps) {
  const selected = options.find((option) => option.id === value) ?? null;

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onValueChange(next === NONE_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        className={cn("min-w-[200px] w-full max-w-xs", triggerClassName, className)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected ? (
            <>
              <EmployeeAvatar
                name={selected.name}
                employeeId={selected.id}
                profileImageUrl={selected.profileImageUrl}
                size="xs"
              />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{noneLabel}</span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE_VALUE}>
          <span className="text-muted-foreground">{noneLabel}</span>
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <EmployeeAvatar
              name={option.name}
              employeeId={option.id}
              profileImageUrl={option.profileImageUrl}
              size="xs"
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{option.name}</span>
              {option.subtitle ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {option.subtitle}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
