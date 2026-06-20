"use client";

import * as React from "react";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - hidden on mobile, width managed by itself on desktop */}
      <div className="hidden md:block">
        <SidebarNav />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex relative">
          <div className="absolute left-4 top-2 z-50 md:hidden">
             {/* Render mobile sidebar trigger here so it sits on top-bar on mobile */}
             <SidebarNav />
          </div>
          <div className="w-full">
            <TopBar />
          </div>
        </div>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
