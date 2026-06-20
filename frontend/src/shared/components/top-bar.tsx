"use client";

import * as React from "react";
import { useAuth } from "@/domains/auth";
import { ThemeToggle } from "./theme-toggle";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopBar() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold tracking-tight hidden sm:block">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          {/* Trigger styled directly — no nested Button to avoid <button><button> */}
          <DropdownMenuTrigger
            className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56" align="end">
            {/* Label must be inside a Group — Base UI requirement */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">{user?.name}</span>
                  <span className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <div className="px-2 py-1 flex flex-wrap gap-1">
                {user?.roles?.map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px] capitalize">
                    {role}
                  </Badge>
                ))}
              </div>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => signOut()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
