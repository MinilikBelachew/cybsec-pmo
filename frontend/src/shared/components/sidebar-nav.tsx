"use client";

import * as React from "react";
import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { cn } from "@/shared/utils/cn";
import { sidebarNav } from "@/config/sidebar.config";
import { useAuth } from "@/domains/auth";
import { useLocalStorage } from "@/shared/hooks/use-local-storage";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/shared/ui/tooltip";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { APP_NAME } from "@/shared/constants";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Filter nav items by role
  // (Assuming no role config per item for now, but leaving space for it)
  const filteredNav = sidebarNav; 

  const NavContent = () => (
    <div className="flex h-full flex-col bg-background border-r relative">
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && !isMobile ? "justify-center px-0" : "justify-between")}>
        {!collapsed || isMobile ? (
          <span className="font-semibold">{APP_NAME}</span>
        ) : (
          <span className="font-bold text-xl">{APP_NAME[0]}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  collapsed && !isMobile && "justify-center"
                )}
              >
                <item.icon className={cn("h-5 w-5", (!collapsed || isMobile) && "mr-3")} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed && !isMobile) {
              return (
                <TooltipProvider key={item.href}>
                  <Tooltip>
                    <TooltipTrigger render={linkContent} />
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return linkContent;
          })}
        </nav>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden ml-2" />}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <VisuallyHidden.Root>
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>Main navigation for the application</SheetDescription>
          </VisuallyHidden.Root>
          <NavContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className={cn("hidden md:block transition-all duration-300 relative", collapsed ? "w-16" : "w-64")}>
      <NavContent />
      {!isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3.5 top-6 z-10 h-7 w-7 rounded-full bg-background"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}
    </aside>
  );
}
