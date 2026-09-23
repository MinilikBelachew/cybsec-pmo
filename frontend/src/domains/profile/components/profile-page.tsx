"use client";

import { useAuth } from "@/domains/auth";
import { PageHeader } from "@/shared/components/page-header";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { Globe, Mail, Shield, UserRound } from "lucide-react";
import { getRoleBadgeColor, getRoleLabel } from "../utils/role-display";

function initials(name?: string) {
  if (!name?.trim()) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Mail;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const roleCode = user?.backendRoleCode || user?.roles?.[0] || "engineer";
  const roleLabel = getRoleLabel(roleCode);
  const isExternal = roleCode === "client" || roleCode === "vendor";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="My Profile" />

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-5 border-b border-border pb-6 sm:flex-row sm:items-start">
          <Avatar className="size-16 rounded-2xl">
            <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2 text-center sm:text-left">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {user?.name || "Signed in"}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email || "No email on this account"}
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge
                className={cn("border px-2 py-0.5 text-xs", getRoleBadgeColor(roleCode))}
              >
                {roleLabel}
              </Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                {isExternal ? "External" : "Internal"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Full name" value={user?.name || "—"} icon={UserRound} />
          <Detail label="Email" value={user?.email || "—"} icon={Mail} />
          <Detail label="Role" value={roleLabel} icon={Shield} />
          <Detail
            label="Identity provider"
            value="Microsoft Entra ID (Azure)"
            icon={Globe}
          />
        </div>
      </section>
    </div>
  );
}
