import { Request } from 'express';

export function extractClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return request.ip || request.socket?.remoteAddress || 'unknown';
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
