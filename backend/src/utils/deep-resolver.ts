import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';

function isBinaryOrStreamPayload(input: unknown): boolean {
  if (input == null || typeof input !== 'object') return false;
  if (input instanceof StreamableFile) return true;
  if (Buffer.isBuffer(input)) return true;
  if (input instanceof Readable) return true;
  if (input instanceof Uint8Array) return true;
  if (input instanceof ArrayBuffer) return true;
  // Nest / Node stream duck-typing (avoid serializing file downloads).
  const maybe = input as { pipe?: unknown; getStream?: unknown };
  if (typeof maybe.pipe === 'function') return true;
  if (typeof maybe.getStream === 'function') return true;
  return false;
}

async function deepResolvePromises(input: unknown): Promise<unknown> {
  if (input instanceof Promise) {
    return await input;
  }

  if (Array.isArray(input)) {
    return Promise.all(input.map((item) => deepResolvePromises(item)));
  }

  if (input instanceof Date) {
    return input;
  }

  // Do not rebuild StreamableFile / Buffer / streams into plain objects —
  // that turns MSPDI XML downloads into a JSON "server object" (TC-M1.8-01).
  if (isBinaryOrStreamPayload(input)) {
    return input;
  }

  if (typeof input === 'object' && input !== null) {
    const keys = Object.keys(input);
    const resolvedObject: Record<string, unknown> = {};

    for (const key of keys) {
      resolvedObject[key] = await deepResolvePromises(
        (input as Record<string, unknown>)[key],
      );
    }

    return resolvedObject;
  }

  return input;
}

export default deepResolvePromises;
