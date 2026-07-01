"use client";

import * as React from "react";
import { useState } from "react";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useAuth } from "@/domains/auth";
import { ROLE_CATALOG } from "@/config/roles.config";
import { NotificationBell } from "@/shared/components/notification-bell";
import { CustomizeModal } from "@/shared/components/customize-modal";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Search,
  User,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  FileText,
  Rocket,
  Blocks,
  Languages,
  Palette,
  Keyboard,
  HelpCircle,
  FolderPlus,
  CheckSquare,
  FileStack,
  GanttChartSquare,
  ClipboardList,
  BarChart2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useSearch } from "@/domains/search";
import { useGetProjectByIdQuery } from "@/domains/projects/api/projects.api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatSegmentLabel(segment: string) {
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function TopBar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { openSearch } = useSearch();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const projectIdIndex = segments.findIndex(
    (segment, index) => segment === "projects" && UUID_RE.test(segments[index + 1] ?? ""),
  );
  const projectId =
    projectIdIndex >= 0 ? segments[projectIdIndex + 1] : undefined;

  const { data: project } = useGetProjectByIdQuery(projectId!, {
    skip: !projectId,
  });

  const currentRoleLabel =
    ROLE_CATALOG.find((r) => r.code === user?.backendRoleCode)?.label ??
    user?.backendRoleCode?.replace(/_/g, " ") ??
    "User";

  // Dynamic breadcrumbs based on pathname
  const breadcrumbs = segments.map((seg, i) => {
    let label = formatSegmentLabel(seg);

    if (projectId && seg === projectId) {
      label = project?.name ?? "Project";
    }

    return {
      label,
      isLast: i === segments.length - 1,
      href: "/" + segments.slice(0, i + 1).join("/"),
    };
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-5 bg-background/90 backdrop-blur-md border-b border-border/85 shrink-0">
      
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1 text-sm min-w-0 flex-1">
        {breadcrumbs.length === 0 ? (
          <Link
            href="/dashboard"
            className="text-foreground font-semibold text-sm hover:text-primary transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          breadcrumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />}
              {crumb.isLast ? (
                <span
                  className="truncate text-xs md:text-sm text-foreground font-semibold"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Center Search Bar ── */}
      <div className="flex-1 flex justify-center max-w-xl mx-4 relative hidden md:flex">
        <button
          type="button"
          onClick={openSearch}
          className="relative group cursor-pointer flex items-center h-9 w-64 lg:w-96 rounded-[2rem] bg-muted/40 border border-border/40 hover:bg-muted/60 hover:border-border transition-all"
          aria-label="Open search"
        >
          <div className="pl-3 pr-2 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-medium text-left">
            <span>Search anything...</span>
            <span className="text-[10px] opacity-40 font-mono">⌘K</span>
          </div>
          <div className="pr-1.5 flex items-center pointer-events-none">
            <div className="flex items-center gap-1 h-7 pl-0 pr-0.5 rounded-full group-hover:pl-2 transition-all duration-300 overflow-hidden">
              <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap max-w-0 opacity-0 group-hover:max-w-[50px] group-hover:opacity-100 transition-all duration-300">
                Ask AI
              </span>
              <div className="h-6 w-6 rounded-full flex items-center justify-center bg-background/80 shadow-sm border border-border/20">
                <Blocks className="h-3 w-3 text-primary" />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* ── Right Actions ── */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <button
          type="button"
          onClick={openSearch}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70"
          aria-label="Open search"
        >
          <Search className="size-4" />
        </button>

        <NotificationBell />

        {/* User Account Multi-Column Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center h-9 gap-1.5 px-1.5 rounded-lg hover:bg-muted/60 transition-colors group outline-none"
            aria-label="User Account Options"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[440px] p-0 overflow-hidden rounded-xl border border-border/60 bg-background">
            {/* Header info card */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">{user?.name || "Robel Elias"}</span>
                <span className="text-[10px] text-muted-foreground">{user?.email || "roba@pmo.local"}</span>
              </div>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-2 divide-x divide-border/60">
              
              {/* Left Column: Account Actions */}
              <div className="p-2 space-y-0.5">
                <p className="px-2.5 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Account
                </p>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/profile")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/settings")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Organization settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/download")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Download Reports</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </div>

              {/* Right Column: PMO Quick Actions */}
              <div className="p-2 space-y-0.5">
                <p className="px-2.5 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Quick Actions
                </p>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/tasks")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                  <span>Active Tasks</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/documents")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <FileStack className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Document Vault</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/gantt")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <GanttChartSquare className="h-3.5 w-3.5 text-amber-500" />
                  <span>Gantt charts</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/risks")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  <span>Risk Register</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <p className="px-2.5 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Tools
                </p>
                <DropdownMenuItem
                  onClick={() => setCustomizeOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 cursor-pointer"
                >
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Themes</span>
                </DropdownMenuItem>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <CustomizeModal open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      </div>
    </header>
  );
}
