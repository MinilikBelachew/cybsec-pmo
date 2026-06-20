"use client";

import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "./error-boundary";
import { Spinner } from "./spinner";

interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}

export function AsyncBoundary({
  children,
  fallback = <Spinner />,
  errorFallback,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
