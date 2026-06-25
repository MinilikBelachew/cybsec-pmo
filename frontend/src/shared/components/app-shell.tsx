"use client";

import * as React from "react";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { RoleProvider } from "@/shared/providers/role-provider";
import { SessionTimeoutProvider } from "@/domains/auth/components/session-timeout-provider";
import { AuthHydrator } from "@/domains/auth/components/auth-hydrator";
import { BreakGlassBanner } from "./break-glass-banner";

import { AbilityProvider } from "@/domains/auth/casl/ability-context";
import { useAppSelector } from "@/store/hooks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const permissions = useAppSelector((s) => s.auth.permissions);

  return (
    <AbilityProvider permissions={permissions}>
      <RoleProvider>
        <SessionTimeoutProvider>
          <AuthHydrator />
        <div className="flex h-screen overflow-hidden bg-background">
          <div className="hidden md:flex h-full p-3 shrink-0">
            <SidebarNav />
          </div>

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <BreakGlassBanner />
            <div className="flex relative items-center">
              <div className="absolute left-2 z-50 md:hidden">
                <SidebarNav />
              </div>
              <div className="w-full">
                <TopBar />
              </div>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-transparent">
              {children}
            </main>
          </div>
        </div>
      </SessionTimeoutProvider>
    </RoleProvider>
    </AbilityProvider>
  );
}

