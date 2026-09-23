import { Spinner } from "@/shared/components/spinner";
import React from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ChevronDown, ChevronRight, FolderOpen, Layers, CheckSquare, Milestone } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import {
  ParsedProjectRow,
  ParsedPhaseRow,
  ParsedTaskRow,
  ParsedMilestoneRow,
} from "../../utils/import-export";
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
  badgeCounts?: { phases: number; tasks: number; milestones: number };
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
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
  badgeCounts,
  onLoadMore,
  hasMore,
  loadingMore,
}: ProjectAccordionItemProps) {
  const isProjectExisting = proj.errors.some((err) => err.includes("already exists"));

  const phasesCount = badgeCounts?.phases ?? phasesList.length;
  const tasksCount = badgeCounts?.tasks ?? tasksList.length;
  const milestonesCount = badgeCounts?.milestones ?? milestonesList.length;

  const activeListLength =
    activeTab === "phases"
      ? phasesList.length
      : activeTab === "tasks"
        ? tasksList.length
        : milestonesList.length;

  const showInitialLoading = Boolean(loadingMore && activeListLength === 0);

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
          {phasesCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <Layers className="size-3" />
              {phasesCount} Phases
            </Badge>
          )}
          {tasksCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <CheckSquare className="size-3" />
              {tasksCount} Tasks
            </Badge>
          )}
          {milestonesCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold">
              <Milestone className="size-3" />
              {milestonesCount} Milestones
            </Badge>
          )}
        </div>
      </button>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Sub-Tabs */}
          <div className="flex border-b border-border gap-2">
            {phasesCount > 0 && (
              <button
                onClick={() => onTabChange("phases")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "phases"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Phases ({phasesCount})
              </button>
            )}
            {tasksCount > 0 && (
              <button
                onClick={() => onTabChange("tasks")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "tasks"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Tasks ({tasksCount})
              </button>
            )}
            {milestonesCount > 0 && (
              <button
                onClick={() => onTabChange("milestones")}
                className={cn(
                  "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                  activeTab === "milestones"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Milestones ({milestonesCount})
              </button>
            )}
          </div>

          {/* Table per active tab */}
          <div className="border border-border/60 rounded-lg overflow-x-auto bg-card max-h-[30vh]">
            {showInitialLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Spinner size="sm" />
                <span className="text-xs font-medium">Loading…</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="h-8 gap-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
              >
                {loadingMore ? (
                  <Spinner size="xs" />
                ) : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
