"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { defineAbilityFor, type AppAbility } from "./define-ability";
import type { PermissionRow } from "../types/permissions.types";

const AbilityContext = createContext<AppAbility | null>(null);

export function AbilityProvider({
  permissions,
  children,
}: {
  permissions: PermissionRow[];
  children: ReactNode;
}) {
  const ability = useMemo(
    () => defineAbilityFor(permissions),
    [permissions],
  );

  return (
    <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
  );
}

export function useAppAbility(): AppAbility | null {
  return useContext(AbilityContext);
}
