"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@/shared/utils/cn"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverPortal = PopoverPrimitive.Portal

interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Popup> {
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(({ className, align = "center", side = "bottom", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} className="isolate z-50">
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 p-4 text-slate-950 dark:text-slate-50 shadow-md outline-none",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent, PopoverPortal }
