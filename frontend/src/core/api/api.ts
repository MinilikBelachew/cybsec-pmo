import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithInterceptor } from "./base-api";

// ---------------------------------------------------------------------------
// Base API — all domain APIs inject endpoints into this
// ---------------------------------------------------------------------------
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithInterceptor,
  // Tag types used for cache invalidation across all domains
  tagTypes: ["User", "Auth", "Permissions", "Profile", "Users", "Projects", "PortfolioStats", "Departments", "Currencies","Customers", "ProjectManagers", "Tasks", "TaskProgress", "TaskDependencies", "Phases", "Milestones", "WorkspaceDocuments", "Audit", "KekaSyncLogs", "FailedSyncRecords", "KekaTimesheetReconcile", "Roles", "Settings", "Notifications", "ProjectTeam", "TeamDirectory", "AllocationApprovals", "Timesheets", "TimesheetApprovals", "TimesheetSyncFailures", "UtilisationReport", "ProjectTemplates", "ActionPoints", "HolidayCalendars"],
  endpoints: () => ({}), // domains inject their own endpoints
});
