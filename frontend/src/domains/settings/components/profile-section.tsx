"use client";

import { useAuth } from "@/domains/auth";
import { useRole } from "@/shared/providers/role-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Globe, Shield, User as UserIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { getRoleBadgeColor, getRoleLabel } from "../utils/role-display";

export function ProfileSection() {
  const { user: currentUser } = useAuth();
  const { userRole } = useRole();

  return (
    <Card className="rounded-2xl border bg-card">
      <CardHeader>
        <CardTitle>Enterprise User Profile</CardTitle>
        <CardDescription>
          Your enterprise profile details synced from Microsoft Entra ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center border-b pb-6 border-border">
          <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UserIcon className="size-8 text-primary" />
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold">{currentUser?.name || "No Name"}</h3>
            <p className="text-sm text-muted-foreground">{currentUser?.email || "No Email"}</p>
            <div className="flex gap-2 justify-center sm:justify-start pt-1">
              {currentUser?.roles?.map((role) => (
                <Badge key={role} className={cn("text-xs border px-2 py-0.5", getRoleBadgeColor(role))}>
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">Integration Partner</label>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/20">
              <Globe className="size-4 text-primary" />
              <span className="text-sm">Microsoft Azure (Entra ID)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">Access Level</label>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-muted/20">
              <Shield className="size-4 text-primary" />
              <span className="text-sm capitalize">{userRole.replace("_", " ")} Access</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
