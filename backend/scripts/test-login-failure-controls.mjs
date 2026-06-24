#!/usr/bin/env node
/**
 * UAT helper for M1.6-03 — failed-login controls.
 * Sends invalid id_tokens to POST /v1/auth/entra/login and prints status codes.
 *
 * Usage: node scripts/test-login-failure-controls.mjs [baseUrl]
 * Example: node scripts/test-login-failure-controls.mjs http://localhost:6002/api/v1
 */

const baseUrl = process.argv[2] ?? 'http://localhost:6002/api/v1';

async function attemptLogin(index) {
  const res = await fetch(`${baseUrl}/auth/entra/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: `invalid-token-${index}` }),
  });

  const retryAfter = res.headers.get('retry-after');
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  console.log(
    `#${index} status=${res.status} retry-after=${retryAfter ?? '-'} code=${body?.code ?? '-'} message=${body?.message ?? body}`,
  );
}

async function main() {
  console.log(`Testing login failure controls at ${baseUrl}/auth/entra/login\n`);
  for (let i = 1; i <= 12; i++) {
    await attemptLogin(i);
    await new Promise((r) => setTimeout(r, 100));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
