"use client";

import { useCallback, useState } from "react";
import {
  ProjectLeaveImpactSection,
  ProjectTeamSection,
  type PendingTeamMember,
} from "@/domains/projects";

type TeamViewProps = {
  projectId: string;
  departmentId?: string;
  startDate?: string | null;
  endDate?: string | null;
  canEdit: boolean;
};

export function TeamView({
  projectId,
  departmentId,
  startDate,
  endDate,
  canEdit,
}: TeamViewProps) {
  const [pendingMembers, setPendingMembers] = useState<PendingTeamMember[]>([]);
  const handlePendingMembersChange = useCallback((members: PendingTeamMember[]) => {
    setPendingMembers(members);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-transparent">
      <div className="shrink-0 border-b border-border/50 px-6 py-4">
        <h2 className="text-sm font-bold text-foreground">Project team</h2>
        <p className="text-xs text-muted-foreground">
          Allocation roster, staffing policies, and leave impact for this project.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <ProjectTeamSection
          variant="workspace"
          projectId={projectId}
          departmentId={departmentId}
          startDate={startDate}
          endDate={endDate}
          pendingMembers={pendingMembers}
          onPendingMembersChange={handlePendingMembersChange}
          canEdit={canEdit}
        />

        <ProjectLeaveImpactSection projectId={projectId} />
      </div>
    </div>
  );
}
