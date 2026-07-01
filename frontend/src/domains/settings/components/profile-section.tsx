"use client";

import { useAuth } from "@/domains/auth";
import { useRole } from "@/shared/providers/role-provider";
import { Badge } from "@/shared/ui/badge";
import { Globe, Shield, User as UserIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { getRoleBadgeColor, getRoleLabel } from "../utils/role-display";

export function ProfileSection() {
  const { user: currentUser } = useAuth();
  const { userRole } = useRole();

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Enterprise User Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your enterprise profile details synced from Microsoft Entra ID.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 border-b border-border pb-6 sm:flex-row">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <UserIcon className="size-8 text-primary" />
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold">{currentUser?.name || "No Name"}</h3>
          <p className="text-sm text-muted-foreground">{currentUser?.email || "No Email"}</p>
          <div className="flex justify-center gap-2 pt-1 sm:justify-start">
            {currentUser?.roles?.map((role) => (
              <Badge key={role} className={cn("border px-2 py-0.5 text-xs", getRoleBadgeColor(role))}>
                {getRoleLabel(role)}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Integration Partner
          </label>
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Globe className="size-4 text-primary" />
            <span className="text-sm">Microsoft Azure (Entra ID)</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted-foreground">Access Level</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Shield className="size-4 text-primary" />
            <span className="text-sm capitalize">{userRole.replace("_", " ")} Access</span>
          </div>
        </div>
      </div>
    </section>
  );
}
