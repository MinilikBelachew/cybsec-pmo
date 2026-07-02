import React from "react";
import { Badge } from "@/shared/ui/badge";
import { ChevronDown, ChevronRight, FolderOpen, Layers, CheckSquare, Milestone } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ParsedProjectRow, ParsedPhaseRow, ParsedTaskRow, ParsedMilestoneRow } from "../../utils/import-export";
import { PhasesPreviewTable } from "./phases-preview-table";
import { TasksPreviewTable } from "./tasks-preview-table";
import { MilestonesPreviewTable } from "./milestones-preview-table";

interface ProjectAccordionItemProps {
  proj: ParsedProjectRow;
  isExpanded: boolean;
  onToggle: () => void;
  phasesList: ParsedPhaseRow[];
  tasksList: ParsedTaskRow[];
  milestonesList: ParsedMilestoneRow[];
  activeTab: "phases" | "tasks" | "milestones";
  onTabChange: (tab: "phases" | "tasks" | "milestones") => void;
  handleSubRowChange: (
    projName: string,
    type: "phases" | "tasks" | "milestones",
    rowIndex: number,
    field: string,
    value: any
  ) => void;
}

export function ProjectAccordionItem({
  proj,
  isExpanded,
  onToggle,
  phasesList,
  tasksList,
  milestonesList,
  activeTab,
  onTabChange,
  handleSubRowChange,
}: ProjectAccordionItemProps) {
  const isProjectExisting = proj.errors.some((err) => err.includes("already exists"));

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden bg-muted/5",
        isProjectExisting ? "border-border/40 opacity-70" : "border-border/80"
      )}
    >
      {/* Accordion Header */}
      <button
        onClick={() => !isProjectExisting && onToggle()}
        disabled={isProjectExisting}
        className={cn(
          "w-full flex items-center justify-between p-4 bg-muted/20 border-b border-border/60 transition text-left",
          isProjectExisting
            ? "opacity-50 cursor-not-allowed bg-muted/10"
            : "hover:bg-muted/30 cursor-pointer"
        )}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <FolderOpen className="size-4.5 text-primary shrink-0" />
          <span
            className={cn(
              "text-xs font-bold",
              isProjectExisting ? "text-muted-foreground font-medium" : "text-foreground"
            )}
          >
            {proj.name}
            {isProjectExisting && (
              <span className="text-[10px] text-rose-500 font-bold ml-2">
                (Project already exists — Sheets disabled)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phasesList.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <Layers className="size-3" />
              {phasesList.length} Phases
            </Badge>
          )}
          {tasksList.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <CheckSquare className="size-3" />
              {tasksList.length} Tasks
            </Badge>
          )}
          {milestonesList.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <Milestone className="size-3" />
              {milestonesList.length} Milestones
            </Badge>
          )}
        </div>
      </button>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Sub-Tabs */}
          <div className="flex border-b border-border gap-2">
            {phasesList.length > 0 && (
              <button
                onClick={() => onTabChange("phases")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "phases"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Phases ({phasesList.length})
              </button>
            )}
            {tasksList.length > 0 && (
              <button
                onClick={() => onTabChange("tasks")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "tasks"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Tasks ({tasksList.length})
              </button>
            )}
            {milestonesList.length > 0 && (
              <button
                onClick={() => onTabChange("milestones")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "milestones"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Milestones ({milestonesList.length})
              </button>
            )}
          </div>

          {/* Table per active tab */}
          <div className="border border-border/60 rounded-lg overflow-x-auto bg-card max-h-[30vh]">
            {activeTab === "phases" && phasesList.length > 0 && (
              <PhasesPreviewTable
                phasesList={phasesList}
                projName={proj.name}
                handleSubRowChange={handleSubRowChange}
              />
            )}
            {activeTab === "tasks" && tasksList.length > 0 && (
              <TasksPreviewTable
                tasksList={tasksList}
                projName={proj.name}
                handleSubRowChange={handleSubRowChange}
              />
            )}
            {activeTab === "milestones" && milestonesList.length > 0 && (
              <MilestonesPreviewTable
                milestonesList={milestonesList}
                projName={proj.name}
                handleSubRowChange={handleSubRowChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
