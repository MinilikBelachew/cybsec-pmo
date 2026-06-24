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
