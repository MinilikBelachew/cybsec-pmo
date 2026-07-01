import { Request } from 'express';

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed === '::1' || trimmed === '::ffff:127.0.0.1' || trimmed === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }
  return trimmed;
}

function readHeaderIp(header: string | string[] | undefined): string | null {
  if (typeof header === 'string' && header.length > 0) {
    return normalizeIp(header.split(',')[0]);
  }
  if (Array.isArray(header) && header[0]) {
    return normalizeIp(header[0].split(',')[0]);
  }
  return null;
}

export function extractClientIp(request: Request): string {
  const forwardedIp =
    readHeaderIp(request.headers['cf-connecting-ip']) ??
    readHeaderIp(request.headers['x-real-ip']) ??
    readHeaderIp(request.headers['x-forwarded-for']);

  if (forwardedIp) {
    return forwardedIp;
  }

  return normalizeIp(request.ip || request.socket?.remoteAddress || 'unknown');
}

export function extractUserAgent(request: Request): string | null {
  const ua = request.headers['user-agent'];
  return typeof ua === 'string' ? ua : null;
}

export function parseUserAgent(ua: string | undefined | null): string {
  if (!ua) return 'Unknown';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  let browser = 'Unknown Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';

  return `${browser} on ${os}`;
}

export function formatIpWithUserAgent(ip: string | null, ua: string | null): string | null {
  const parsedUa = parseUserAgent(ua);
  if (!ip) return parsedUa;
  return `${ip} (${parsedUa})`;
}
