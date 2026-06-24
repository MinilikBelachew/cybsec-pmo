"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/shared/utils/cn"
import { buttonVariants } from "@/shared/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-slate-500 rounded-md w-9 font-normal text-[0.8rem] dark:text-slate-400 text-center",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-100/50 [&:has([aria-selected])]:bg-slate-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 dark:[&:has([aria-selected].day-outside)]:bg-white/[0.02] dark:[&:has([aria-selected])]:bg-white/[0.05]",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal hover:bg-slate-100 dark:hover:bg-white/[0.05] flex items-center justify-center rounded-lg"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-bold",
        outside:
          "outside text-slate-400 opacity-50 dark:text-slate-500 aria-selected:bg-slate-100/50 aria-selected:text-slate-400 aria-selected:opacity-30 dark:aria-selected:bg-white/[0.02] dark:aria-selected:text-slate-500",
        disabled: "text-slate-400 opacity-50 dark:text-slate-500",
        range_middle:
          "aria-selected:bg-slate-100 aria-selected:text-slate-900 dark:aria-selected:bg-white/[0.05] dark:aria-selected:text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          if (orientation === "right") {
            return <ChevronRight className="h-4 w-4" />
          }
          if (orientation === "up") {
            return <ChevronUp className="h-4 w-4" />
          }
          if (orientation === "down") {
            return <ChevronDown className="h-4 w-4" />
          }
          return <ChevronLeft className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
