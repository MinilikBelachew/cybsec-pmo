"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { usePathname, Link } from "@/i18n/routing";
import { cn } from "@/shared/utils/cn";
import { getVisibleSections, type NavSection } from "@/config/sidebar.config";
import { useAuth } from "@/domains/auth";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  ChevronDown,
  Pin,
  PinOff
} from "lucide-react";
import { APP_NAME } from "@/shared/constants";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useRole } from "@/shared/providers/role-provider";

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { userRole } = useRole();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mounted, setMounted] = useState(false);

  // Use simple states initialized to defaults to match server rendering and avoid hydration mismatch
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["execution"]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(["tasks", "log-hours"]);

  // On mount, load states from localStorage and set mounted flag
  useEffect(() => {
    try {
      const storedCollapsed = localStorage.getItem("sidebar-collapsed");
      if (storedCollapsed !== null) {
        setCollapsed(JSON.parse(storedCollapsed));
      }
      const storedOpen = localStorage.getItem("sidebar-open-sections");
      if (storedOpen !== null) {
        setOpenSections(JSON.parse(storedOpen));
      }
      const storedPinned = localStorage.getItem("sidebar-pinned-ids");
      if (storedPinned !== null) {
        setPinnedIds(JSON.parse(storedPinned));
      }
    } catch (e) {
      console.error("Error reading localStorage:", e);
    }
    setMounted(true);
  }, []);

  const handleSetCollapsed = useCallback((val: boolean) => {
    setCollapsed(val);
    try {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(val));
    } catch (e) {
      console.error("Error writing localStorage:", e);
    }
  }, []);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("sidebar-open-sections", JSON.stringify(next));
      } catch (e) {
        console.error("Error writing localStorage:", e);
      }
      return next;
    });
  }, []);

  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try {
        localStorage.setItem("sidebar-pinned-ids", JSON.stringify(next));
      } catch (e) {
        console.error("Error writing localStorage:", e);
      }
      return next;
    });
  }, []);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Render a static skeleton match on the server to prevent any hydration mismatch
  if (!mounted) {
    return (
      <div className="flex h-full gap-2 select-none pointer-events-none">
        {/* Left rail skeleton */}
        <div className="flex flex-col w-14 shrink-0 rounded-xl border border-border bg-gradient-to-b from-primary to-primary/90 overflow-hidden text-primary-foreground" />
        {/* Right pane skeleton */}
        <div className="flex flex-col rounded-xl border border-border bg-card w-60 overflow-hidden" />
      </div>
    );
  }

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => {
    const isCollapsedLayout = collapsed && !mobile;
    const visibleSections = getVisibleSections([userRole]);

    // Flatten visible items for pinned lookup
    const allPinnableItems = visibleSections.flatMap((s) =>
      s.children
        ? s.children.map((c) => ({ ...c, parentLabel: s.label }))
        : [{ ...s, href: s.href ?? "#", parentLabel: "" }]
    );
    const pinnedItems = pinnedIds
      .map((id) => allPinnableItems.find((item) => item.id === id))
      .filter(Boolean) as typeof allPinnableItems;

    return (
      <div className="flex h-full gap-2">
        {/* ── 1. Left Icon Rail (Sleeker and smaller width: w-14) ──────────────── */}
        <div className="flex flex-col w-14 shrink-0 rounded-xl border border-border bg-gradient-to-b from-primary to-primary/90 overflow-hidden text-primary-foreground">
          <div className="flex items-center justify-center h-14 border-b border-primary-foreground/10 shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-5 bg-white -skew-x-12 rounded-full shadow-lg shadow-white/40" />
              <div className="w-1.5 h-5 bg-white/30 -skew-x-12 rounded-full" />
            </div>
          </div>

          {/* Icons navigation list */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col gap-1.5 px-2 scrollbar-none">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const sectionActive = section.href
                ? isActive(section.href)
                : section.children?.some((c) => isActive(c.href));

              return (
                <button
                  key={section.id}
                  onClick={(e) => {
                    if (section.href) {
                      window.location.href = `/${userRole}${section.href}`;
                    } else {
                      if (collapsed && !mobile) {
                        handleSetCollapsed(false);
                      }
                      toggleSection(section.id);
                    }
                  }}
                  title={section.label}
                  className={cn(
                    "group relative flex items-center justify-center size-10 rounded-xl transition-all duration-150 mx-auto",
                    sectionActive
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {sectionActive && (
                    <span className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-white" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Collapse toggle at bottom (hidden on mobile) */}
          {!mobile && (
            <div className="border-t border-primary-foreground/10 p-2 shrink-0">
              <button
                onClick={() => handleSetCollapsed(!collapsed)}
                className="flex items-center justify-center size-10 rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition-all duration-150 mx-auto"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </button>
            </div>
          )}
        </div>

        {/* ── 2. Expanded Navigation Panel ─────────────────────────────────── */}
        <div
          className={cn(
            "flex flex-col rounded-xl border border-border bg-card transition-all duration-300 ease-in-out",
            isCollapsedLayout ? "w-0 opacity-0 border-transparent overflow-hidden" : "w-60 opacity-100 overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 h-14 px-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1 h-5 bg-[#7B3FE4] -skew-x-12 rounded-full" />
                <div className="w-1 h-5 bg-foreground/60 -skew-x-12 rounded-full" />
              </div>
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase whitespace-nowrap">{APP_NAME}</span>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-none">
            
            {/* ── Pinned Section ── */}
            {pinnedItems.length > 0 && (
              <div className="mb-3 space-y-0.5 border-b border-border/60 pb-3">
                <p className="text-[10px] font-bold text-muted-foreground/50 px-2 mb-1 uppercase tracking-wider whitespace-nowrap">
                  Pinned
                </p>
                {pinnedItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={`pinned-${item.id}`}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 whitespace-nowrap",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="flex-1 truncate text-[13px] whitespace-nowrap">{item.label}</span>
                      <button
                        onClick={(e) => togglePin(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-primary shrink-0"
                        title="Unpin"
                      >
                        <PinOff className="size-3" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ── Regular Navigation Sections ── */}
            {visibleSections.map((section) => {
              const Icon = section.icon;

              if (!section.children) {
                const sectionActive = isActive(section.href);
                return (
                  <Link
                    key={section.id}
                    href={section.href ?? "#"}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 whitespace-nowrap",
                      sectionActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate whitespace-nowrap">{section.label}</span>
                  </Link>
                );
              }

              // Section with submenus/children
              const isOpen = openSections.includes(section.id);
              const hasActiveChild = section.children.some((c) => isActive(c.href));

              return (
                <div key={section.id} className="space-y-0.5">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-bold transition-all duration-150 text-left whitespace-nowrap",
                      hasActiveChild
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate whitespace-nowrap">{section.label}</span>
                    <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  {/* Children Items */}
                  {isOpen && (
                    <div className="ms-3 ps-3 border-s border-border space-y-0.5 py-0.5">
                      {section.children.map((child) => {
                        const CIcon = child.icon;
                        const childActive = isActive(child.href);
                        const isPinned = pinnedIds.includes(child.id);
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            className={cn(
                              "group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap",
                              childActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <CIcon className="size-3.5 shrink-0" />
                            <span className="flex-1 truncate whitespace-nowrap">{child.label}</span>
                            <button
                              onClick={(e) => togglePin(child.id, e)}
                              className={cn(
                                "transition-all duration-150 p-0.5 rounded shrink-0",
                                isPinned
                                  ? "opacity-100 text-primary animate-in fade-in zoom-in-50"
                                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                              )}
                              title={isPinned ? "Unpin" : "Pin"}
                            >
                              {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                            </button>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* User Profile Footer */}
          <div className="border-t border-border p-2 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/40 whitespace-nowrap">
              <div className="size-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">
                  {user?.name ? getInitials(user.name) : "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate whitespace-nowrap">{user?.name || "User"}</p>
                <p className="text-[9px] text-muted-foreground capitalize truncate whitespace-nowrap">
                  {userRole.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden ml-2" />}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-2 bg-background border-r">
          <VisuallyHidden.Root>
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>Main navigation for the application</SheetDescription>
          </VisuallyHidden.Root>
          <NavContent mobile={true} />
        </SheetContent>
      </Sheet>
    );
  }

  return <NavContent mobile={false} />;
}
