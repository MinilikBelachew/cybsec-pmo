import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function resolveKeyMaterial(): Buffer {
  const raw = process.env.INTEGRATION_SECRETS_KEY?.trim();
  if (raw) {
    // Accept 64-char hex or any string (hashed to 32 bytes).
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return createHash('sha256').update(raw).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTEGRATION_SECRETS_KEY is required to encrypt integration credentials in production.',
    );
  }

  // Deterministic local-dev fallback so the form works without extra setup.
  return createHash('sha256')
    .update('cybsec-pmo-dev-integration-secrets-key')
    .digest();
}

/**
 * Encrypt a secret for at-rest storage.
 * Format: base64(iv).base64(tag).base64(ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const key = resolveKeyMaterial();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const key = resolveKeyMaterial();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted secret payload.');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

export function maskSecretValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 6) return '••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-2)}`;
}
