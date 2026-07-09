import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';
import { KekaPagedResponse, KekaTokenResponse } from '../keka.types';

type QueryParams = Record<string, string | number | undefined>;

@Injectable()
export class KekaHttpClient {
  private readonly logger = new Logger(KekaHttpClient.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const token = await this.getAccessToken();
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    return this.parseResponse<T>(response, path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = this.buildUrl(path);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return this.parseResponse<T>(response, path);
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
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      api_key: apiKey,
      scope: 'kekaapi',
    });

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      const message =
        typeof payload === 'object' &&
        payload &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : `Keka request failed for ${path} with status ${response.status}`;
      this.logger.error(message);
      throw new Error(message);
    }

    return payload as T;
  }
}
