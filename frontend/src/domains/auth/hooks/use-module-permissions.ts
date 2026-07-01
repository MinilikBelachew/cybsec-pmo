"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { hasModulePermission } from "../utils/module-permissions";

export function useModulePermissions() {
  const permissions = useAppSelector((state) => state.auth.permissions);

  return useMemo(
    () => ({
      canViewProjects: hasModulePermission(permissions, "projects", "view"),
      canCreateProjects: hasModulePermission(permissions, "projects", "create"),
      canEditProjects: hasModulePermission(permissions, "projects", "edit"),
      canApproveProjects: hasModulePermission(permissions, "projects", "approve"),
      canViewFinancials: hasModulePermission(permissions, "financials", "view"),
      canImportProjects: hasModulePermission(permissions, "project_import", "import"),
      canExportProjects: hasModulePermission(permissions, "project_export", "export"),
      canEditTeam: hasModulePermission(permissions, "team", "edit"),
      canEditMilestones: hasModulePermission(permissions, "milestones", "edit"),
      canEditDependencies: hasModulePermission(permissions, "dependencies", "edit"),
    }),
    [permissions],
  );
}
