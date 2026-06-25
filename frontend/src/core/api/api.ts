import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithInterceptor } from "./base-api";

// ---------------------------------------------------------------------------
// Base API — all domain APIs inject endpoints into this
// ---------------------------------------------------------------------------
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithInterceptor,
  // Tag types used for cache invalidation across all domains
  tagTypes: ["User", "Auth", "Permissions", "Profile", "Users", "Projects", "Departments", "Customers", "ProjectManagers", "Tasks", "Phases", "Milestones"],
  endpoints: () => ({}), // domains inject their own endpoints
});
