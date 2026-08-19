"use client";

import { Suspense } from "react";
import { SettingsPage } from "@/domains/settings";

export default function SettingsRoute() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
