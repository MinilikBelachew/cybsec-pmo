"use client";

import { isEnabled } from ".";

interface FeatureFlagGateProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlagGate({ flag, children, fallback = null }: FeatureFlagGateProps) {
  if (!isEnabled(flag)) return <>{fallback}</>;
  return <>{children}</>;
}
