"use client";

import { type ReactNode } from "react";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { useAppSelector } from "@/store/hooks";
import type { CaslAction } from "@/domains/auth/casl/casl.constants";

interface PermissionGateProps {
  action: CaslAction;
  subject: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  action,
  subject,
  children,
  fallback = null,
}: PermissionGateProps) {
  const ability = useAppAbility();
  const permissionsLoaded = useAppSelector((s) => s.auth.permissionsLoaded);

  if (!permissionsLoaded) return null;

  const hasAccess = ability?.can(action, subject) ?? false;

  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
}
