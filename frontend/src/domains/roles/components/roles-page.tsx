"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/shared/components/page-header";
import { useGetRolesQuery } from "../api/roles.api";
import { RolesAccordion } from "./roles-accordion";

export function RolesPage() {
  const [search, setSearch] = useState("");

  const rolesQuery = useMemo(
    () => ({
      page: 1,
      limit: 100,
      sortBy: "code" as const,
      sortOrder: "asc" as const,
    }),
    [],
  );

  const { data: rolesData, isLoading, isFetching } = useGetRolesQuery(rolesQuery);

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Roles"
        description="Expand a role to inspect and manage its permissions, grouped by module."
      />

      <RolesAccordion
        roles={rolesData?.data ?? []}
        isLoading={isLoading || isFetching}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}
