"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import type { RoleListItem } from "../types/roles.types";
import { formatRoleCodeLabel } from "../utils/format-permission";
import { RolePermissionsPanel } from "./role-permissions-panel";

const ROLE_GROUPS = [
  {
    id: "admin",
    label: "Platform admin",
    codes: ["super_admin", "it_admin"],
  },
  {
    id: "pmo",
    label: "PMO & delivery",
    codes: ["pmo_lead", "pm", "team_lead", "engineer"],
  },
  {
    id: "business",
    label: "Business",
    codes: ["finance", "hr", "sales"],
  },
  {
    id: "external",
    label: "External",
    codes: ["client", "vendor"],
  },
] as const;

type RolesAccordionProps = {
  roles: RoleListItem[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
};

export function RolesAccordion({
  roles,
  isLoading,
  search,
  onSearchChange,
}: RolesAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;

    return roles.filter((role) => {
      const haystack = [role.code, role.label, formatRoleCodeLabel(role.code)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [roles, search]);

  const groupedRoles = useMemo(() => {
    const assigned = new Set<number>();
    const groups: Array<{ id: string; label: string; roles: RoleListItem[] }> = ROLE_GROUPS.map(
      (group) => {
        const items = filteredRoles.filter((role) => {
          if (!(group.codes as readonly string[]).includes(role.code)) return false;
          assigned.add(role.id);
          return true;
        });
        return { id: group.id, label: group.label, roles: items };
      },
    ).filter((group) => group.roles.length > 0);

    const other = filteredRoles.filter((role) => !assigned.has(role.id));
    if (other.length > 0) {
      groups.push({ id: "other", label: "Other", roles: other });
    }

    return groups;
  }, [filteredRoles]);

  const toggleRole = (roleId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search roles by name or code…"
          maxLength={200}
          className="h-10 border-border/60 bg-white ps-9 shadow-none dark:bg-card"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`role-skeleton-${index}`}
              className="h-16 animate-pulse rounded-xl border border-border/50 bg-muted/30"
            />
          ))}
        </div>
      )}

      {!isLoading && filteredRoles.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No roles found.
        </div>
      )}

      {!isLoading &&
        groupedRoles.map((group) => (
          <section key={group.id} className="space-y-2">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.roles.map((role) => {
                const expanded = expandedIds.has(role.id);
                return (
                  <div
                    key={role.id}
                    className={cn(
                      "overflow-hidden rounded-xl border border-border/60 bg-card transition-colors",
                      expanded && "border-primary/25 shadow-sm",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          expanded ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                        )}
                      >
                        <ShieldCheck className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{role.label}</span>
                          <Badge variant={role.isExternal ? "outline" : "secondary"} className="h-5 text-[10px]">
                            {role.isExternal ? "External" : "Internal"}
                          </Badge>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span title={role.code}>{formatRoleCodeLabel(role.code)}</span>
                          <span className="tabular-nums">{role.permissionCount} permissions</span>
                          <time dateTime={role.createdAt}>
                            {new Date(role.createdAt).toLocaleDateString()}
                          </time>
                        </span>
                      </span>

                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          expanded && "rotate-180 text-primary",
                        )}
                      />
                    </button>

                    {expanded && <RolePermissionsPanel role={role} compact />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
