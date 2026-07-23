"use client";

import * as React from "react";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { RoleProvider } from "@/shared/providers/role-provider";
import { SessionTimeoutProvider } from "@/domains/auth/components/session-timeout-provider";
import { RequireAuth } from "@/domains/auth/components/require-auth";
import { BreakGlassBanner } from "./break-glass-banner";
import { SearchProvider } from "@/domains/search";

import { AbilityProvider } from "@/domains/auth/casl/ability-context";
import { useAppSelector } from "@/store/hooks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const permissions = useAppSelector((s) => s.auth.permissions);

  return (
    <RequireAuth>
      <AbilityProvider permissions={permissions}>
        <RoleProvider>
          <SearchProvider>
            <SessionTimeoutProvider>
              <div className=" max-w-full flex h-screen overflow-hidden bg-background">
                <div className="hidden md:flex h-full p-3 shrink-0">
                  <SidebarNav />
                </div>

                <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
                  <BreakGlassBanner />
                  <div className="flex items-center shrink-0 min-w-0 border-b border-border/85">
                    <div className="shrink-0 pl-2 md:hidden">
                      <SidebarNav />
                    </div>
                    <div className="min-w-0 flex-1">
                      <TopBar />
                    </div>
                  </div>

                  <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 lg:p-8 bg-transparent">
                    {children}
                  </main>
                </div>
              </div>
            </SessionTimeoutProvider>
          </SearchProvider>
        </RoleProvider>
      </AbilityProvider>
    </RequireAuth>
  );
}
