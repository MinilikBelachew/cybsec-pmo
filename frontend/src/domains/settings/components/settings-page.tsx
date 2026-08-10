"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { useAuth } from "@/domains/auth";
import { Users, Settings, ShieldAlert, Archive, Briefcase, Activity, Palette } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { ProfileSection } from "./profile-section";
import { UserDirectorySection } from "./user-directory-section";
import { BreakGlassSection } from "./break-glass-section";
import { SessionTimeoutSection } from "./session-timeout-section";
import { TimesheetEscalationSection } from "./timesheet-escalation-section";
import { AuditComplianceSection } from "./audit-compliance-section";
import { AllocationPoliciesSection } from "./allocation-policies-section";
import { HealthRulesSection } from "./health-rules-section";
import { BrandingProfilesSection } from "./branding-profiles-section";

type SettingsTab =
  | "profile"
  | "users"
  | "security"
  | "audit"
  | "allocation"
  | "health"
  | "branding";

export function SettingsPage() {
  const ability = useAppAbility();
  const { user } = useAuth();
  const canManageUsers = ability?.can("read", "User") ?? false;
  const canManageSecurity =
    user?.backendRoleCode === "super_admin" ||
    (ability?.can("manage", "Settings") ?? false);
  const canManageHealthRules =
    (ability?.can("manage", "Report") ?? false) ||
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
      />

      <div className="flex overflow-x-auto border-b border-border gap-2">
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
        {canManageHealthRules && (
          <button
            type="button"
            onClick={() => setActiveTab("health")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex shrink-0 items-center gap-2",
              activeTab === "health"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="size-4" />
            Health rules
          </button>
        )}
        
        {canManageSecurity && (
          <button
            type="button"
            onClick={() => setActiveTab("branding")}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              activeTab === "branding"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Palette className="size-4" />
            Branding
          </button>
        )}
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

      {activeTab === "allocation" && canManageSecurity && (
        <AllocationPoliciesSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}

      {activeTab === "branding" && canManageSecurity && (
        <BrandingProfilesSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}

      {activeTab === "audit" && canManageSecurity && (
        <AuditComplianceSection
          onSuccess={notifySuccess}
          onError={notifyError}
        />
      )}

      {activeTab === "security" && canManageSecurity && (
        <div className="space-y-6">
          <SessionTimeoutSection
            onSuccess={notifySuccess}
            onError={notifyError}
          />
          <TimesheetEscalationSection
            onSuccess={notifySuccess}
            onError={notifyError}
          />
          <BreakGlassSection
            onSuccess={notifySuccess}
            onError={notifyError}
          />
        </div>
      )}
      {activeTab === "health" && canManageHealthRules && <HealthRulesSection />}
    </div>
  );
}
