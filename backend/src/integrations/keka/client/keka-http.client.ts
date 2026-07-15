import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../../config/config.type';
import {
  KEKA_RATE_LIMIT_MAX_RETRIES,
  KEKA_RATE_LIMIT_PER_MINUTE,
  KEKA_RATE_LIMIT_WINDOW_MS,
} from '../keka.constants';
import { KekaPagedResponse, KekaTokenResponse } from '../keka.types';

type QueryParams = Record<string, string | number | undefined>;

/**
 * Keka enforces 50 API requests / 60s window
 * (https://developers.keka.com/reference/rate-limit).
 * Auth token calls hit a different host and are not counted here.
 */
@Injectable()
export class KekaHttpClient {
  private readonly logger = new Logger(KekaHttpClient.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  /** Timestamps of API requests inside the current rolling minute. */
  private requestTimestamps: number[] = [];
  /** Serialize rate-slot acquisition so concurrent callers don't race. */
  private rateGate: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.requestWithRateLimit('GET', path, params);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.requestWithRateLimit('POST', path, undefined, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.requestWithRateLimit('PUT', path, undefined, body);
  }

  async getAllPages<T>(
    path: string,
    params?: QueryParams,
    pageSize = 100,
  ): Promise<T[]> {
    const items: T[] = [];
    let pageNumber = 1;
    let totalPages = 1;

    do {
      const page = await this.get<KekaPagedResponse<T>>(path, {
        ...params,
        pageNumber,
        pageSize,
      });

      if (page.succeeded === false) {
        throw new Error(page.message ?? `Keka paged request failed for ${path}`);
      }

      items.push(...(page.data ?? []));
      totalPages = page.totalPages ?? 1;
      pageNumber += 1;
    } while (pageNumber <= totalPages);

    return items;
  }

  private async requestWithRateLimit<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    params?: QueryParams,
    body?: unknown,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      await this.acquireRateSlot();

      const token = await this.getAccessToken();
      const url = this.buildUrl(path, params);
      const hasBody = method === 'POST' || method === 'PUT';
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'Mozilla',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        attempt += 1;
        const waitMs = this.msUntilQuotaRefill();
        this.logger.warn(
          `Keka rate limit hit on ${method} ${path}; waiting ${Math.ceil(waitMs / 1000)}s before retry ${attempt}/${KEKA_RATE_LIMIT_MAX_RETRIES}`,
        );
        if (attempt > KEKA_RATE_LIMIT_MAX_RETRIES) {
          return this.parseResponse<T>(response, path);
        }
        await this.sleep(waitMs);
        continue;
      }

      return this.parseResponse<T>(response, path);
    }
  }

  /**
   * Wait until we can send another request without exceeding
   * KEKA_RATE_LIMIT_PER_MINUTE in the rolling 60s window.
   * Uses max-1 as a soft cap so a concurrent retry still has headroom.
   */
  private async acquireRateSlot(): Promise<void> {
    const run = this.rateGate.then(async () => {
      const softCap = Math.max(1, KEKA_RATE_LIMIT_PER_MINUTE - 1);

      while (true) {
        const now = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter(
          (ts) => now - ts < KEKA_RATE_LIMIT_WINDOW_MS,
        );

        if (this.requestTimestamps.length < softCap) {
          this.requestTimestamps.push(Date.now());
          return;
        }

        const oldest = this.requestTimestamps[0] ?? now;
        const waitMs = Math.max(
          50,
          KEKA_RATE_LIMIT_WINDOW_MS - (now - oldest) + 100,
        );
        this.logger.debug(
          `Keka rate gate: ${this.requestTimestamps.length}/${KEKA_RATE_LIMIT_PER_MINUTE} in window; waiting ${Math.ceil(waitMs / 1000)}s`,
        );
        await this.sleep(waitMs);
      }
    });

    this.rateGate = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  private msUntilQuotaRefill(): number {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < KEKA_RATE_LIMIT_WINDOW_MS,
    );
    if (this.requestTimestamps.length === 0) {
      return 1_000;
    }
    const oldest = this.requestTimestamps[0]!;
    return Math.max(
      1_000,
      KEKA_RATE_LIMIT_WINDOW_MS - (now - oldest) + 250,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const authUrl = this.configService.getOrThrow('keka.authUrl', { infer: true });
    const clientId = this.configService.getOrThrow('keka.clientId', { infer: true });
    const clientSecret = this.configService.getOrThrow('keka.clientSecret', {
      infer: true,
    });
    const apiKey = this.configService.getOrThrow('keka.apiKey', { infer: true });

    const body = new URLSearchParams({
      grant_type: 'kekaapi',
      client_id: clientId,
      client_secret: clientSecret,
      api_key: apiKey,
      scope: 'kekaapi',
    });

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Keka auth failed (${response.status}): ${text}`);
      throw new Error(`Keka authentication failed with status ${response.status}`);
    }

    const payload = (await response.json()) as KekaTokenResponse;
    this.accessToken = payload.access_token;
    this.tokenExpiresAt = now + payload.expires_in * 1000;
    return this.accessToken;
  }

  private buildUrl(path: string, params?: QueryParams): string {
    const baseUrl = this.configService
      .getOrThrow('keka.apiBaseUrl', { infer: true })
      .replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${baseUrl}${normalizedPath}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async parseResponse<T>(response: Response, path: string): Promise<T> {
    const text = await response.text();
    let payload: unknown = {};

    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const message = this.formatErrorMessage(payload, path, response.status);
      this.logger.error(message);
      throw new Error(message);
    }

    return payload as T;
  }

  private formatErrorMessage(
    payload: unknown,
    path: string,
    status: number,
  ): string {
    const fallback = `Keka request failed for ${path} with status ${status}`;
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    const record = payload as {
      message?: unknown;
      errors?: unknown;
    };
    const message =
      typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : fallback;
    const errors = Array.isArray(record.errors)
      ? record.errors.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];

    if (errors.length === 0) {
      return message;
    }

    return `${message}: ${errors.join('; ')}`;
  }
}
