import https from 'https';
import { URL } from 'url';

type HttpFormResponse = {
  status: number;
  text: string;
};

/**
 * POST application/x-www-form-urlencoded over HTTPS using Node's https module.
 * Prefer this over undici `fetch` for Microsoft login endpoints: on some Linux
 * networks Node's fetch (undici) hits ETIMEDOUT while https + IPv4 succeeds.
 */
export function httpsFormPost(
  urlStr: string,
  body: string,
  options?: { timeoutMs?: number; family?: 4 | 6 | 0 },
): Promise<HttpFormResponse> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const family = options?.family ?? 4;
  const url = new URL(urlStr);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        family: family === 0 ? undefined : family,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTPS request timed out after ${timeoutMs}ms`));
    });
    req.write(body);
    req.end();
  });
}
