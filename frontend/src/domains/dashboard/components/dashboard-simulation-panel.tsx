"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { ArrowUpDown } from "lucide-react";
import { ProjectHealthItem } from "../api/dashboard.api";
import { Sparkline } from "./dashboard-charts";

export function ProjectSimulationPanel({ projects }: { projects: ProjectHealthItem[] }) {
  const [selectedProjId, setSelectedProjId] = useState<string>("");
  const [simulatedProgress, setSimulatedProgress] = useState<number>(50);

  const selectedProj = projects.find((p) => p.id === selectedProjId) || projects[0];

  const handleSimulate = () => {
    if (!selectedProj) return;
  };

  const getSimulatedStatus = () => {
    if (!selectedProj) return "on-track";
    if (simulatedProgress >= 75) return "on-track";
    if (simulatedProgress >= 40) return "at-risk";
    return "delayed";
  };

  const simulatedStatus = getSimulatedStatus();

  const STATUS_LABELS: Record<string, string> = {
    "on-track": "bg-emerald-500 text-white",
    "at-risk": "bg-amber-400 text-white",
    "delayed": "bg-rose-500 text-white",
  };

  const progressTrend = [10, 20, 25, 45, 60, simulatedProgress];

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-4 h-full flex flex-col justify-between">
      <div>
        <p className="text-sm font-bold">Project Health Simulator</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Simulate resource and task completion outcomes</p>
      </div>

      <div className="space-y-3">
        {/* Project Selector Box */}
        <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
          <label className="text-[10px] font-semibold text-muted-foreground block uppercase">Select Project</label>
          <select
            value={selectedProjId}
            onChange={(e) => {
              setSelectedProjId(e.target.value);
              const p = projects.find((x) => x.id === e.target.value);
              if (p) setSimulatedProgress(p.progress);
            }}
            className="w-full bg-transparent border-0 text-xs font-bold focus:ring-0 mt-1 cursor-pointer outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {projects.length === 0 && (
              <option value="">No projects available</option>
            )}
          </select>
          {selectedProj && (
            <p className="text-[10px] text-muted-foreground mt-1">PM: {selectedProj.pm} · Current: {selectedProj.progress}%</p>
          )}
        </div>

        {/* Swap Direction Badge */}
        <div className="flex justify-center -my-2.5">
          <div className="size-7 rounded-full bg-[#ff6000] text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform">
            <ArrowUpDown className="size-3.5" />
          </div>
        </div>

        {/* Output Health Box */}
        <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
          <label className="text-[10px] font-semibold text-muted-foreground block uppercase">Simulated Health Status</label>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm font-bold capitalize">{simulatedStatus.replace("-", " ")}</p>
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded capitalize", STATUS_LABELS[simulatedStatus])}>
              {simulatedStatus}
            </span>
          </div>
        </div>

        {/* Simulated Progress Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Target Task Completion</span>
            <span className="font-bold text-foreground">{simulatedProgress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={simulatedProgress}
            onChange={(e) => setSimulatedProgress(Number(e.target.value))}
            className="w-full accent-[#ff6000] cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          onClick={handleSimulate}
          className="w-full bg-[#ff6000] text-white hover:bg-[#ff6000]/95 font-semibold text-xs py-2 rounded-lg"
        >
          Apply Simulation
        </Button>

        {/* Sparkline trend representation */}
        <div className="flex items-center justify-between text-[10px] border-t border-border/40 pt-3">
          <div>
            <span className="text-muted-foreground">Simulation Trend</span>
            <p className="font-semibold mt-0.5">Prog. Velocity</p>
          </div>
          <div className="flex items-center gap-1">
            <Sparkline data={progressTrend} color="#ff6000" />
          </div>
        </div>
      </div>
    </div>
  );
}
