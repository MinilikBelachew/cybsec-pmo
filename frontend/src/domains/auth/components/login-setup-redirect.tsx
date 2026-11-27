"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { setupClient } from "@/domains/setup/api/setup.api";

/**
 * On a brand-new production deployment (Entra ID not configured & setup not completed),
 * automatically sends visitors from /login to /setup.
 */
export function LoginSetupRedirect() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === "string" ? params.locale : "en";

  useEffect(() => {
    let cancelled = false;
    setupClient
      .getStatus()
      .then((status) => {
        if (!cancelled && status.redirectToSetup) {
          router.replace(`/${locale}/setup`);
        }
      })
      .catch(() => {
        // Ignore network blips on login page; normal login UI stays visible.
      });
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  return null;
}
