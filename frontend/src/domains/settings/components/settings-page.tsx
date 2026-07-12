"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { useAuth } from "@/domains/auth";
import { Users, Settings, ShieldAlert, Archive } from "lucide-react";
// Phase 2: restore Briefcase when Resource policies tab is re-enabled
// import { Users, Settings, ShieldAlert, Archive, Briefcase } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ProfileSection } from "./profile-section";
import { UserDirectorySection } from "./user-directory-section";
import { BreakGlassSection } from "./break-glass-section";
import { AuditComplianceSection } from "./audit-compliance-section";
// Phase 2: Resource policies (allocation)
// import { AllocationPoliciesSection } from "./allocation-policies-section";

type SettingsTab = "profile" | "users" | "security" | "audit";
// Phase 2: | "allocation"

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

  const notifySuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const notifyError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  return (
    <div className="space-y-6  mx-auto">
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
        {/* Phase 2 — Resource policies
        {canManageSecurity && (
          <button
            type="button"
            onClick={() => setActiveTab("allocation")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "allocation"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Briefcase className="size-4" />
            Resource policies
          </button>
        )}
        */}
        {canManageSecurity && (
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive className="size-4" />
            Audit &amp; Compliance
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

      {activeTab === "profile" && <ProfileSection />}

      {activeTab === "users" && canManageUsers && (
        <UserDirectorySection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}

      {/* Phase 2 — Resource policies
      {activeTab === "allocation" && canManageSecurity && (
        <AllocationPoliciesSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}
      */}

      {activeTab === "audit" && canManageSecurity && (
        <AuditComplianceSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}

      {activeTab === "security" && canManageSecurity && (
        <BreakGlassSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}
    </div>
  );
}
