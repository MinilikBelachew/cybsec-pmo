import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../../config/config.type';
import {
  ZOHO_HTTP_TIMEOUT_MS,
  ZOHO_TOKEN_EXPIRY_SKEW_MS,
} from '../zoho.constants';
import { ZohoConfig } from '../config/zoho-config.type';

type ZohoTokenResponse = {
  access_token?: string;
  expires_in?: number;
  api_domain?: string;
  error?: string;
};

type ZohoListResponse<T> = {
  data?: T[];
  info?: {
    more_records?: boolean;
    page?: number;
    per_page?: number;
    count?: number;
  };
};

@Injectable()
export class ZohoHttpClient {
  private readonly logger = new Logger(ZohoHttpClient.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private apiDomainOverride: string | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  private getConfig(): ZohoConfig {
    const cfg = this.configService.get('zoho', { infer: true });
    if (!cfg) {
      throw new ServiceUnavailableException('Zoho configuration is missing');
    }
    return cfg;
  }

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return Boolean(
      cfg.clientId && cfg.clientSecret && cfg.refreshToken,
    );
  }

  clearTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.apiDomainOverride = null;
  }

  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.tokenExpiresAt - ZOHO_TOKEN_EXPIRY_SKEW_MS
    ) {
      return this.accessToken;
    }

    const cfg = this.getConfig();
    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
      throw new ServiceUnavailableException(
        'Zoho CRM is not configured (missing client id/secret/refresh token)',
      );
    }

    const url = new URL(`${cfg.accountsBaseUrl}/oauth/v2/token`);
    url.searchParams.set('refresh_token', cfg.refreshToken);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('client_secret', cfg.clientSecret);
    url.searchParams.set('grant_type', 'refresh_token');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ZOHO_HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        signal: controller.signal,
      });
      const body = (await response.json()) as ZohoTokenResponse;
      if (!response.ok || !body.access_token) {
        this.logger.warn(
          `Zoho token refresh failed: ${body.error ?? response.status}`,
        );
        throw new ServiceUnavailableException(
          `Zoho token refresh failed: ${body.error ?? response.statusText}`,
        );
      }

      this.accessToken = body.access_token;
      const expiresInSec = body.expires_in ?? 3600;
      this.tokenExpiresAt = Date.now() + expiresInSec * 1000;
      if (body.api_domain) {
        this.apiDomainOverride = body.api_domain.replace(/\/$/, '');
      }
      return this.accessToken;
    } finally {
      clearTimeout(timeout);
    }
  }

  private apiBase(): string {
    const cfg = this.getConfig();
    return this.apiDomainOverride ?? cfg.apiBaseUrl;
  }

  async crmGet<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(`${this.apiBase()}${path.startsWith('/') ? path : `/${path}`}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ZOHO_HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        signal: controller.signal,
      });

      if (response.status === 204) {
        return { data: [] } as T;
      }

      const body = (await response.json()) as T & { code?: string; message?: string };
      if (!response.ok) {
        throw new Error(
          `Zoho CRM ${path} failed (${response.status}): ${
            (body as { message?: string }).message ?? response.statusText
          }`,
        );
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Paginate CRM module records (Deals, etc.). */
  async crmGetAllPages<T>(
    modulePath: string,
    fields?: string,
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let more = true;

    while (more) {
      const pageResult = await this.crmGet<ZohoListResponse<T>>(modulePath, {
        page,
        per_page: 200,
        ...(fields ? { fields } : {}),
      });
      items.push(...(pageResult.data ?? []));
      more = Boolean(pageResult.info?.more_records);
      page += 1;
      if (page > 50) {
        this.logger.warn(`Zoho pagination stopped at page cap for ${modulePath}`);
        break;
      }
    }

    return items;
  }
}
