import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function getBackendOrigin(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
  try {
    const url = new URL(apiUrl.startsWith("http") ? apiUrl : "http://localhost:6001/api/v1");
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:6001";
  }
}

const backendOrigin = getBackendOrigin();
const backendWsOrigin = backendOrigin.replace(/^http/i, "ws");

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: `${backendOrigin}/socket.io/:path*`,
      },
    ];
  },
  async headers() {
    const connectSrc = [
      "'self'",
      "ws:",
      "wss:",
      backendOrigin,
      backendWsOrigin,
      "https://login.microsoftonline.com",
      "https://login.microsoft.com",
      "https://sts.windows.net",
      "https://graph.microsoft.com",
    ];

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' blob: data: ${backendOrigin} https://login.microsoftonline.com`,
      "font-src 'self'",
      `object-src 'self' blob: ${backendOrigin}`,
      "base-uri 'self'",
      "form-action 'self' https://login.microsoftonline.com",
      "frame-ancestors 'none'",
      `connect-src ${connectSrc.join(" ")}`,
      `frame-src 'self' blob: ${backendOrigin} https://login.microsoftonline.com https://login.microsoft.com`,
      "block-all-mixed-content",
    ];

    if (process.env.NODE_ENV === "production") {
      cspDirectives.push("upgrade-insecure-requests");
    }

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
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
