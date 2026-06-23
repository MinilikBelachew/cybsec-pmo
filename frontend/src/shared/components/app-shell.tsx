"use client";

import * as React from "react";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { RoleProvider } from "@/shared/providers/role-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar on Desktop - styled with floating p-3 layout */}
        <div className="hidden md:flex h-full p-3 shrink-0">
          <SidebarNav />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* TopBar & Mobile navigation trigger */}
          <div className="flex relative items-center">
            <div className="absolute left-2 z-50 md:hidden">
               <SidebarNav />
            </div>
            <div className="w-full">
              <TopBar />
            </div>
          </div>
          
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}

