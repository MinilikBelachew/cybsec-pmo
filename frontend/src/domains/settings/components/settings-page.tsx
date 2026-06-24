"use client";

import { useState } from "react";
import { PageHeader } from "@/shared/components/page-header";
import { useRole } from "@/shared/providers/role-provider";
import { Users, CheckCircle, XCircle, Settings } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ProfileSection } from "./profile-section";
import { UserDirectorySection } from "./user-directory-section";

type SettingsTab = "profile" | "users";

export function SettingsPage() {
  const { userRole } = useRole();
  const isSuperAdmin = userRole === "super_admin";

  const [activeTab, setActiveTab] = useState<SettingsTab>(isSuperAdmin ? "users" : "profile");
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
        {isSuperAdmin && (
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

      {activeTab === "users" && isSuperAdmin && (
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
    </div>
  );
}
