import { UAParser } from "ua-parser-js";

export type AuditClientDisplay = {
  ip: string;
  ipLabel: string;
  client: string;
};

const LOOPBACK_IPS = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1", "0:0:0:0:0:0:0:1"]);

function isLoopbackIp(ip: string) {
  return LOOPBACK_IPS.has(ip.toLowerCase());
}

function formatIpLabel(ip: string) {
  if (isLoopbackIp(ip)) return "Localhost";
  return ip;
}

function parseClientFromHint(hint: string | null, rawUserAgent?: string | null) {
  if (rawUserAgent?.trim()) {
    const parsed = new UAParser(rawUserAgent).getResult();
    const browser = parsed.browser.name ?? "Unknown browser";
    const os = parsed.os.name ?? "Unknown OS";
    return `${browser} on ${os}`;
  }

  if (hint?.trim()) return hint.trim();
  return "Unknown client";
}

/**
 * Audit rows store `ipAddress` as either a raw IP or `ip (Browser on OS)`.
 */
export function parseAuditClientDisplay(
  ipAddress: string | null | undefined,
  rawUserAgent?: string | null,
): AuditClientDisplay {
  if (!ipAddress?.trim()) {
    return {
      ip: "—",
      ipLabel: "—",
      client: parseClientFromHint(null, rawUserAgent),
    };
  }

  const combinedMatch = ipAddress.match(/^(.+?)\s+\((.+)\)$/);
  if (combinedMatch) {
    const ip = combinedMatch[1].trim();
    const clientHint = combinedMatch[2].trim();
    return {
      ip,
      ipLabel: formatIpLabel(ip),
      client: parseClientFromHint(clientHint, rawUserAgent),
    };
  }

  return {
    ip: ipAddress.trim(),
    ipLabel: formatIpLabel(ipAddress.trim()),
    client: parseClientFromHint(null, rawUserAgent),
  };
}
