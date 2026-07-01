"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { hasModulePermission } from "../utils/module-permissions";

export function useModulePermissions() {
  const permissions = useAppSelector((state) => state.auth.permissions);

  return useMemo(
    () => ({
      canViewProjects: hasModulePermission(permissions, "projects", "view"),
      canViewTasks: hasModulePermission(permissions, "tasks", "view"),
      canViewReports: hasModulePermission(permissions, "reports", "view"),
      canViewMilestones: hasModulePermission(permissions, "milestones", "view"),
      canViewPhases: hasModulePermission(permissions, "phases", "view"),
      canViewTeam: hasModulePermission(permissions, "team", "view"),
      canViewAudit: hasModulePermission(permissions, "audit", "view"),
      canCreateProjects: hasModulePermission(permissions, "projects", "create"),
      canEditProjects: hasModulePermission(permissions, "projects", "edit"),
      canApproveProjects: hasModulePermission(permissions, "projects", "approve"),
      canViewFinancials: hasModulePermission(permissions, "financials", "view"),
      canImportProjects: hasModulePermission(permissions, "project_import", "import"),
      canExportProjects: hasModulePermission(permissions, "project_export", "export"),
      canEditTeam: hasModulePermission(permissions, "team", "edit"),
      canEditMilestones: hasModulePermission(permissions, "milestones", "edit"),
      canCreatePhases: hasModulePermission(permissions, "phases", "create"),
      canEditPhases: hasModulePermission(permissions, "phases", "edit"),
      canEditDependencies: hasModulePermission(permissions, "dependencies", "edit"),
    }),
    [permissions],
  );
}
