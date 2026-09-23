/**
 * One-shot: exchange Zoho auth code for refresh_token and update .env
 * Usage: node scripts/zoho-exchange-code.js <code>
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Missing code argument');
    process.exit(1);
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  const dc = (process.env.ZOHO_DC || 'com').toLowerCase();
  const hosts = {
    com: 'https://accounts.zoho.com',
    eu: 'https://accounts.zoho.eu',
    in: 'https://accounts.zoho.in',
    au: 'https://accounts.zoho.com.au',
  };
  const base = hosts[dc] || hosts.com;

  const url = new URL(`${base}/oauth/v2/token`);
  url.searchParams.set('code', code);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('grant_type', 'authorization_code');

  const res = await fetch(url.toString(), { method: 'POST' });
  const body = await res.json();

  if (!body.refresh_token && !body.access_token) {
    console.error('Token exchange failed:', body.error || body);
    process.exit(1);
  }

  if (!body.refresh_token) {
    console.error(
      'No refresh_token returned (Zoho only issues it once per consent). Re-run auth with prompt=consent.',
      { hasAccessToken: !!body.access_token },
    );
    process.exit(1);
  }

  const envPath = path.join(__dirname, '..', '.env');
  let envText = fs.readFileSync(envPath, 'utf8');
  if (/^ZOHO_REFRESH_TOKEN=.*/m.test(envText)) {
    envText = envText.replace(
      /^ZOHO_REFRESH_TOKEN=.*/m,
      `ZOHO_REFRESH_TOKEN=${body.refresh_token}`,
    );
  } else {
    envText += `\nZOHO_REFRESH_TOKEN=${body.refresh_token}\n`;
  }
  fs.writeFileSync(envPath, envText, 'utf8');

  console.log('OK: ZOHO_REFRESH_TOKEN updated in .env');
  console.log('api_domain:', body.api_domain || '(none)');
  console.log('Restart backend, then Test Zoho Books connection.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
