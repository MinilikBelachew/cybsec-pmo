import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval for Next.js HMR/dev, unsafe-inline for inline scripts
              "style-src 'self' 'unsafe-inline'", // unsafe-inline for Tailwind/Next.js styles
              "img-src 'self' blob: data: https://login.microsoftonline.com",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://login.microsoftonline.com",
              "frame-ancestors 'none'",
              // Allow MSAL to connect to Microsoft identity endpoints
              "connect-src 'self' https://login.microsoftonline.com https://login.microsoft.com https://sts.windows.net https://graph.microsoft.com http://localhost:6001",
              // Allow MSAL redirect bridge iframes
              "frame-src 'self' https://login.microsoftonline.com https://login.microsoft.com",
              "block-all-mixed-content",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
