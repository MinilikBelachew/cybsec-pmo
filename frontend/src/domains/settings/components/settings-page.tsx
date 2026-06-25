"use client";

import { useState } from "react";
import { PageHeader } from "@/shared/components/page-header";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { useAuth } from "@/domains/auth";
import { Users, CheckCircle, XCircle, Settings, ShieldAlert } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ProfileSection } from "./profile-section";
import { UserDirectorySection } from "./user-directory-section";
import { BreakGlassSection } from "./break-glass-section";

type SettingsTab = "profile" | "users" | "security";

export function SettingsPage() {
  const ability = useAppAbility();
  const { user } = useAuth();
  const canManageUsers = ability?.can("read", "User") ?? false;
  const canManageSecurity =
    user?.backendRoleCode === "super_admin" ||
    (ability?.can("manage", "Settings") ?? false);

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    canManageUsers ? "users" : "profile",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Settings & Administration"
        description="Configure your platform settings, directory access, and enterprise role assignments."
      />

      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cn(
            "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="size-4" />
          My Profile
        </button>
        {canManageUsers && (
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
            User Directory
          </button>
        )}
        {canManageSecurity && (
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "security"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldAlert className="size-4" />
            Security
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3 text-sm font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
          <CheckCircle className="size-4 shrink-0" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2.5">
          <XCircle className="size-4 shrink-0" />
          {actionError}
        </div>
      )}

      {activeTab === "profile" && <ProfileSection />}

      {activeTab === "users" && canManageUsers && (
        <UserDirectorySection
          onSuccess={(message) => {
            setActionError(null);
            setActionSuccess(message);
          }}
          onError={(message) => {
            setActionSuccess(null);
            setActionError(message);
          }}
        />
      )}

      {activeTab === "security" && canManageSecurity && (
        <BreakGlassSection
          onSuccess={(message) => {
            setActionError(null);
            setActionSuccess(message);
          }}
          onError={(message) => {
            setActionSuccess(null);
            setActionError(message);
          }}
        />
      )}
    </div>
  );
}
