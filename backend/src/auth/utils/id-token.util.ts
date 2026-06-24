import * as jwt from 'jsonwebtoken';

/** Best-effort email from an unverified id_token for lockout keying only. */
export function extractEmailHintFromIdToken(
  idToken: string,
): string | null {
  try {
    const payload = jwt.decode(idToken) as {
      email?: string;
      preferred_username?: string;
      upn?: string;
    } | null;

    if (!payload) return null;

    const email =
      payload.email || payload.preferred_username || payload.upn || null;

    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
