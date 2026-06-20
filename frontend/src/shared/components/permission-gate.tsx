"use client";

import { type ReactNode } from "react";
import { can, canAny } from "@/core/permissions/can";
import { Role } from "@/core/permissions/roles";
import { useAppSelector } from "@/store/hooks";

interface PermissionGateProps {
  required: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ required, children, fallback = null }: PermissionGateProps) {
  const roles = useAppSelector((state) => state.auth.user?.roles ?? []);
  const hasAccess = canAny(roles as Role[], required);

  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
}
