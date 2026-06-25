"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useAuth } from "@/domains/auth";
import { ROLE_CATALOG } from "@/config/roles.config";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
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
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Plus,
  Clock,
  FileText,
  AlertTriangle,
  Rocket,
  Blocks,
  Languages,
  Palette,
  Keyboard,
  HelpCircle,
  Download,
  FolderPlus,
  CheckSquare,
  FileStack,
  GanttChartSquare,
  ClipboardList,
  BarChart2,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export function TopBar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const currentRoleLabel =
    ROLE_CATALOG.find((r) => r.code === user?.backendRoleCode)?.label ??
    user?.backendRoleCode?.replace(/_/g, " ") ??
    "User";

  // Dynamic breadcrumbs based on pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    isLast: i === segments.length - 1,
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

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
          <span className="text-foreground font-semibold text-sm">Dashboard</span>
        ) : (
          breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />}
              <span
                className={cn(
                  "truncate text-xs md:text-sm",
                  crumb.isLast ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                {crumb.label}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── Center Search Bar ── */}
      <div className="flex-1 flex justify-center max-w-xl mx-4 relative hidden md:flex">
        <div className="relative group cursor-pointer flex items-center h-9 w-64 lg:w-96 rounded-[2rem] bg-muted/40 border border-border/40 hover:bg-muted/60 hover:border-border transition-all">
          <div className="pl-3 pr-2 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>Search anything...</span>
            <span className="text-[10px] opacity-40 font-mono">⌘K</span>
          </div>
          <div className="pr-1.5 flex items-center">
            <div className="flex items-center gap-1 h-7 pl-0 pr-0.5 rounded-full group-hover:pl-2 hover:bg-muted/80 transition-all duration-300 overflow-hidden">
              <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap max-w-0 opacity-0 group-hover:max-w-[50px] group-hover:opacity-100 transition-all duration-300">
                Ask AI
              </span>
              <div className="h-6 w-6 rounded-full flex items-center justify-center bg-background/80 shadow-sm border border-border/20">
                <Blocks className="h-3 w-3 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Actions ── */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <ThemeToggle />

        <Badge variant="secondary" className="hidden md:inline-flex h-8 px-2.5 text-xs font-semibold">
          {currentRoleLabel}
        </Badge>

        {/* Notifications Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex items-center justify-center size-9 rounded-xl hover:bg-muted/60 transition-all group outline-none"
            aria-label="Open notifications"
          >
            <Bell className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500 border-2 border-background animate-pulse" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 md:w-96 p-0 overflow-hidden rounded-xl border border-border/60 bg-background">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Notifications</span>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] px-1.5 py-0">4 New</Badge>
              </div>
              <button className="text-[10px] font-semibold text-primary hover:underline px-2 py-1 rounded-md">
                Mark all as read
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-border/30 text-xs">
              <NotificationItem
                title="Task Assigned"
                body="You've been assigned to 'Q4 Budget Review'"
                time="5m ago"
                unread
                icon={<Plus className="size-4 text-blue-500" />}
              />
              <NotificationItem
                title="Risk Escalated"
                body="'Vendor delay' risk moved to High severity"
                time="4h ago"
                unread
                icon={<AlertTriangle className="size-4 text-amber-500" />}
              />
              <NotificationItem
                title="Timesheet Approved"
                body="Your timesheet for Week 42 has been approved"
                time="1d ago"
                icon={<Clock className="size-4 text-emerald-500" />}
              />
            </div>
            <button className="w-full py-2.5 text-center text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all border-t border-border/50">
              View all notifications
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Account Multi-Column Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center h-9 gap-1.5 px-1.5 rounded-lg hover:bg-muted/60 transition-colors group outline-none"
            aria-label="User Account Options"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                alt="User Profile"
                className="object-cover"
              />
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
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function NotificationItem({
  title,
  body,
  time,
  unread,
  icon,
}: {
  title: string;
  body: string;
  time: string;
  unread?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-muted/40 relative group",
        unread && "bg-primary/5"
      )}
    >
      <div className="size-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-card">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <p className={cn("text-xs font-bold truncate", unread ? "text-foreground" : "text-muted-foreground")}>
            {title}
          </p>
          <span className="text-[9px] text-muted-foreground/50 shrink-0">{time}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 leading-normal">
          {body}
        </p>
      </div>
      {unread && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />}
    </div>
  );
}
