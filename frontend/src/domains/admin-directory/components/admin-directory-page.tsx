"use client";

import { useState } from "react";
import { Building2, Users, UserRound } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";
import { useAuth } from "@/domains/auth";
import { AdminUsersPanel } from "./admin-users-panel";
import { AdminEmployeesPanel } from "./admin-employees-panel";
import { AdminDepartmentsPanel } from "./admin-departments-panel";

type DirectoryTab = "users" | "employees" | "departments";

const TABS: Array<{
  id: DirectoryTab;
  label: string;
  icon: typeof Users;
  description: string;
}> = [
  {
    id: "users",
    label: "Users",
    icon: Users,
    description: "Login identities, roles, and SSO status",
  },
  {
    id: "employees",
    label: "Employees",
    icon: UserRound,
    description: "Keka-synced people, capacity, and departments",
  },
  {
    id: "departments",
    label: "Departments",
    icon: Building2,
    description: "Org departments and Keka department links",
  },
];

export function AdminDirectoryPage() {
  const { user } = useAuth();
  const isAllowed =
    user?.backendRoleCode === "super_admin" ||
    user?.backendRoleCode === "it_admin";

  const [tab, setTab] = useState<DirectoryTab>("users");

  if (!isAllowed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        People & Org is limited to Super Admin and IT Admin.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & Org"
        description="Master view of users, employees, and departments for platform admins."
      />

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {TABS.find((item) => item.id === tab)?.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {TABS.find((item) => item.id === tab)?.description}
          </p>
        </div>
        {tab === "users" ? <AdminUsersPanel /> : null}
        {tab === "employees" ? <AdminEmployeesPanel /> : null}
        {tab === "departments" ? <AdminDepartmentsPanel /> : null}
      </section>
    </div>
  );
}
