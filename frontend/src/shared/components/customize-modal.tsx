"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useTheme } from "next-themes";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useThemeColor, type ThemeColor } from "@/shared/hooks/use-theme-color";

interface CustomizeModalProps {
  open: boolean;
  onClose: () => void;
}

const themeColors: { name: string; value: ThemeColor; colorClass: string }[] = [
  { name: "Purple", value: "purple", colorClass: "bg-purple-500" },
  { name: "Blue", value: "blue", colorClass: "bg-blue-500" },
  { name: "Pink", value: "pink", colorClass: "bg-pink-500" },
  { name: "Violet", value: "violet", colorClass: "bg-violet-500" },
  { name: "Indigo", value: "indigo", colorClass: "bg-indigo-500" },
  { name: "Orange", value: "orange", colorClass: "bg-orange-500" },
  { name: "Teal", value: "teal", colorClass: "bg-teal-500" },
  { name: "Bronze", value: "bronze", colorClass: "bg-amber-700" },
  { name: "Mint", value: "mint", colorClass: "bg-emerald-400" },
];

export function CustomizeModal({ open, onClose }: CustomizeModalProps) {
  const { theme, setTheme } = useTheme();
  const { themeColor, setThemeColor } = useThemeColor();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border bg-popover p-8 shadow-xl",
            "transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95",
          )}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <div className="mb-4">
            <DialogPrimitive.Title className="text-xl font-semibold text-foreground">
              Customize
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Personalize and organize your PMO interface
            </DialogPrimitive.Description>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Appearance</h4>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
                    { id: "system", label: "Auto" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={cn(
                        "w-full aspect-[4/3] rounded-lg border-2 p-1",
                        theme === option.id
                          ? "border-primary"
                          : "border-border hover:border-border/80",
                      )}
                    >
                      {option.id === "light" && (
                        <div className="flex h-full w-full flex-col gap-2 rounded-md bg-[#ecedef] p-2">
                          <div className="flex gap-2">
                            <div className="size-3 rounded bg-primary" />
                            <div className="h-2 w-8 rounded bg-slate-300" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-2 w-10 rounded bg-slate-300" />
                            <div className="h-2 w-4 rounded bg-primary" />
                          </div>
                        </div>
                      )}
                      {option.id === "dark" && (
                        <div className="flex h-full w-full flex-col gap-2 rounded-md bg-slate-900 p-2">
                          <div className="flex gap-2">
                            <div className="size-3 rounded bg-primary" />
                            <div className="h-2 w-8 rounded bg-slate-700" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-2 w-10 rounded bg-slate-700" />
                            <div className="h-2 w-4 rounded bg-primary" />
                          </div>
                        </div>
                      )}
                      {option.id === "system" && (
                        <div className="flex h-full w-full overflow-hidden rounded-md">
                          <div className="flex w-1/2 flex-col gap-2 border-r border-slate-300 bg-[#ecedef] p-2">
                            <div className="size-3 rounded bg-primary" />
                            <div className="h-2 w-full rounded bg-slate-300" />
                          </div>
                          <div className="flex w-1/2 flex-col gap-2 bg-slate-900 p-2">
                            <div className="mt-5 h-2 w-full rounded bg-slate-700" />
                            <div className="h-2 w-4 rounded bg-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">PMO theme</h4>
              <div className="grid grid-cols-3 gap-2">
                {themeColors.map((color) => {
                  const isActive = themeColor === color.value;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setThemeColor(color.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded",
                          color.colorClass,
                        )}
                      >
                        {isActive && (
                          <Check className="size-3 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-sm",
                          isActive && "font-medium text-primary",
                        )}
                      >
                        {color.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
