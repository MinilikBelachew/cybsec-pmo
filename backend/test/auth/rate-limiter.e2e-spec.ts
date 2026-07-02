/**
 * Rate-Limiter & Account-Lockout E2E Tests
 * =========================================
 * These tests exercise the AuthFailureService through the real HTTP stack,
 * so the backend + Redis must be running.
 *
 * How the system works (quick recap):
 *
 *   1. RATE LIMIT   – per IP, per minute window
 *      Key  : auth:rl:ip:<ip>
 *      Limit: AUTH_LOGIN_RATE_LIMIT (default 10 req / 60 s)
 *      Error: 429  { code: "AUTH_RATE_LIMITED" }
 *
 *   2. FAILURE COUNT – per IP  AND  per email, per 15-min window
 *      Keys : auth:fail:ip:<ip>  /  auth:fail:email:<email>
 *      Peak = max(ipFailures, emailFailures)
 *      At AUTH_LOGIN_MAX_FAILURES (default 5) → lockout is set
 *
 *   3. LOCKOUT – per IP  AND  per email, 30-min TTL
 *      Keys : auth:lock:ip:<ip>  /  auth:lock:email:<email>
 *      Error: 429  { code: "AUTH_LOGIN_LOCKED" }
 *
 *   4. SUCCESS RESET – on successful login ALL four keys for that
 *      IP + email are deleted.
 *
 * Test strategy
 * -------------
 * We use the /api/v1/auth/entra/callback endpoint which is the real
 * guarded path (uses assertLoginAllowed before any token work).
 * Sending a garbage `code` triggers an INVALID_TOKEN failure after
 * the rate / lock check → perfect for counting without needing real
 * Azure credentials.
 *
 * To control the "IP" as seen by the backend we set X-Forwarded-For.
 * The backend must be configured with `trust proxy` for this to work
 * (NestJS default when behind a load-balancer, or set
 * APP_TRUST_PROXY=1 in your env).
 */

import request from 'supertest';
import { APP_URL } from '../utils/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unique fake IPs so tests never share state */
let ipCounter = 1;
function nextIp(): string {
  return `10.0.${Math.floor(ipCounter / 255)}.${ipCounter++ % 255 || 1}`;
}

/** Unique fake emails */
let emailCounter = 1;
function nextEmail(): string {
  return `tester-${emailCounter++}-${Date.now()}@example.com`;
}

/**
 * Hit the Entra callback with a bogus code.
 * The backend always redirects on Entra callback failures, so we check
 * the Location header for the error code fragment.
 *
 * Returns the raw supertest response so callers can assert status / headers.
 */
async function tryEntraLogin(ip: string, _emailHint?: string) {
  return request(APP_URL)
    .get('/api/v1/auth/entra/callback')
    .set('X-Forwarded-For', ip)
    .query({ code: 'BOGUS_CODE', state: 'BOGUS_STATE' })
    .redirects(0); // don't follow redirect so we can inspect the 302
}

/**
 * Hit the emergency-login endpoint with a bad secret.
 * This endpoint uses the same assertLoginAllowed check and returns JSON 429
 * directly (not a redirect) so it is easier to assert rate-limit responses.
 *
 * The endpoint signature: POST /api/v1/auth/emergency-login
 * Body: { email, secret, reason }
 */
async function tryEmergencyLogin(ip: string, email: string) {
  return request(APP_URL)
    .post('/api/v1/auth/emergency-login')
    .set('X-Forwarded-For', ip)
    .send({ email, secret: 'wrong-secret', reason: 'e2e test' });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Auth Rate-Limiter & Lockout (E2E)', () => {
  // -------------------------------------------------------------------------
  // 1. RATE LIMIT
  // -------------------------------------------------------------------------
  describe('1 – IP Rate Limit (AUTH_RATE_LIMITED)', () => {
    it('should allow up to 10 requests from the same IP within 60 s', async () => {
      const ip = nextIp();
      const email = nextEmail();

      for (let i = 0; i < 10; i++) {
        const res = await tryEmergencyLogin(ip, email);
        // Should NOT be rate-limited (may be 401 / 403 / 400 for bad secret)
        expect(res.status).not.toBe(429);
      }
    });

    it('should return 429 AUTH_RATE_LIMITED on the 11th request from the same IP', async () => {
      const ip = nextIp();
      const email = nextEmail();

      for (let i = 0; i < 10; i++) {
        await tryEmergencyLogin(ip, email);
      }

      const blocked = await tryEmergencyLogin(ip, email);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('AUTH_RATE_LIMITED');
    });

    it('should include a Retry-After header when rate-limited', async () => {
      const ip = nextIp();
      const email = nextEmail();

      for (let i = 0; i < 10; i++) {
        await tryEmergencyLogin(ip, email);
      }

      const blocked = await tryEmergencyLogin(ip, email);
      expect(blocked.status).toBe(429);
      const retryAfter = blocked.headers['retry-after'];
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it('should NOT rate-limit a different IP in the same window', async () => {
      const ipA = nextIp();
      const ipB = nextIp(); // completely separate IP
      const email = nextEmail();

      // Exhaust ipA
      for (let i = 0; i < 10; i++) {
        await tryEmergencyLogin(ipA, email);
      }
      const blockedA = await tryEmergencyLogin(ipA, email);
      expect(blockedA.status).toBe(429);

      // ipB should still be clean
      const cleanB = await tryEmergencyLogin(ipB, email);
      expect(cleanB.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // 2. ACCOUNT LOCKOUT – IP axis
  // -------------------------------------------------------------------------
  describe('2 – IP Lockout after repeated failures (AUTH_LOGIN_LOCKED)', () => {
    /**
     * Default: maxFailures = 5, failureWindowSec = 900 (15 min),
     * lockoutSec = 1800 (30 min).
     *
     * We use unique IPs so the rate-limit (10 / min) is never hit before
     * the failure lockout (5 failures).
     */
    it('should lock the IP after 5 failed attempts', async () => {
      const ip = nextIp();
      const email = nextEmail();

      // 5 failures → lockout is set
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ip, email);
      }

      // 6th attempt from same IP → should see AUTH_LOGIN_LOCKED
      const locked = await tryEmergencyLogin(ip, email);
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('AUTH_LOGIN_LOCKED');
    });

    it('should lock the IP even when different emails are used from same IP', async () => {
      const ip = nextIp();

      // Use 5 DIFFERENT emails from the same IP
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ip, nextEmail());
      }

      // 6th attempt → IP is locked
      const locked = await tryEmergencyLogin(ip, nextEmail());
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('AUTH_LOGIN_LOCKED');
    });

    it('should NOT lock a different IP when another IP is locked', async () => {
      const ipA = nextIp();
      const ipB = nextIp();
      const email = nextEmail();

      // Lock ipA
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ipA, email);
      }
      const lockedA = await tryEmergencyLogin(ipA, email);
      expect(lockedA.status).toBe(429);
      expect(lockedA.body.code).toBe('AUTH_LOGIN_LOCKED');

      // ipB is untouched – should not be locked
      const cleanB = await tryEmergencyLogin(ipB, email);
      expect(cleanB.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // 3. ACCOUNT LOCKOUT – email axis
  // -------------------------------------------------------------------------
  describe('3 – Email Lockout after repeated failures (AUTH_LOGIN_LOCKED)', () => {
    it('should lock the email after 5 failed attempts from different IPs', async () => {
      const email = nextEmail();

      // 5 failures, each from a DIFFERENT IP (so IP lockout doesn't trigger)
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(nextIp(), email);
      }

      // 6th attempt (new IP again) → email is locked
      const locked = await tryEmergencyLogin(nextIp(), email);
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('AUTH_LOGIN_LOCKED');
    });

    it('should NOT lock a different email when one email is locked', async () => {
      const emailA = nextEmail();
      const emailB = nextEmail();

      // Lock emailA from 5 different IPs
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(nextIp(), emailA);
      }
      const lockedA = await tryEmergencyLogin(nextIp(), emailA);
      expect(lockedA.status).toBe(429);
      expect(lockedA.body.code).toBe('AUTH_LOGIN_LOCKED');

      // emailB on a fresh IP should be clean
      const cleanB = await tryEmergencyLogin(nextIp(), emailB);
      expect(cleanB.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // 4. BOTH axes can lock independently
  // -------------------------------------------------------------------------
  describe('4 – IP locked but different email still works on a fresh IP', () => {
    it('should allow emailB on ipC even after emailA on ipA is locked', async () => {
      const ipA = nextIp();
      const ipC = nextIp();
      const emailA = nextEmail();
      const emailB = nextEmail();

      // Lock emailA + ipA
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ipA, emailA);
      }
      const locked = await tryEmergencyLogin(ipA, emailA);
      expect(locked.status).toBe(429);

      // Completely separate IP + email should still be free
      const free = await tryEmergencyLogin(ipC, emailB);
      expect(free.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Entra callback redirect codes (visual / integration)
  // -------------------------------------------------------------------------
  describe('5 – Entra callback redirects carry error codes', () => {
    it('should redirect with ?error=rate_limited when IP is rate-limited', async () => {
      const ip = nextIp();

      // Exhaust the rate limit
      for (let i = 0; i < 10; i++) {
        await tryEntraLogin(ip);
      }

      const res = await tryEntraLogin(ip);
      // Backend redirects; it should NOT be a 200.
      // The Location URL should contain rate_limited.
      const location = res.headers['location'] ?? '';
      expect(location).toMatch(/rate_limited/);
    });

    it('should redirect with ?error=login_locked when IP is locked', async () => {
      const ip = nextIp();

      // Trigger lockout via emergency-login (5 failures, same IP)
      const email = nextEmail();
      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ip, email);
      }

      // Now try Entra callback from the same locked IP
      const res = await tryEntraLogin(ip);
      const location = res.headers['location'] ?? '';
      expect(location).toMatch(/login_locked/);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Retry-After semantics
  // -------------------------------------------------------------------------
  describe('6 – Retry-After header values', () => {
    it('rate-limit Retry-After should be ≤ 60 s (the rate window)', async () => {
      const ip = nextIp();
      const email = nextEmail();

      for (let i = 0; i < 10; i++) {
        await tryEmergencyLogin(ip, email);
      }

      const res = await tryEmergencyLogin(ip, email);
      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
    });

    it('lockout Retry-After should be ≤ 1800 s (the lockout window)', async () => {
      const ip = nextIp();
      const email = nextEmail();

      for (let i = 0; i < 5; i++) {
        await tryEmergencyLogin(ip, email);
      }

      const res = await tryEmergencyLogin(ip, email);
      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(1800);
    });
  });
});
