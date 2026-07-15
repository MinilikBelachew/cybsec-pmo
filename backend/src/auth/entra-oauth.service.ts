import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { AllConfigType } from '../config/config.type';
import { RedisService } from '../redis/redis.service';
import { httpsFormPost } from './utils/https-form-post.util';

const OAUTH_STATE_TTL_SECONDS = 600;
const OAUTH_STATE_PREFIX = 'entra:oauth:';
const OAUTH_CODE_PREFIX = 'entra:oauth:code:';
const OAUTH_CODE_TTL_SECONDS = 300;
const TOKEN_EXCHANGE_MAX_ATTEMPTS = 3;

type StoredOAuthState = {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
};

type EntraTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class EntraOauthService {
  private readonly logger = new Logger(EntraOauthService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly redisService: RedisService,
  ) {}

  async createAuthorizationRequest(returnTo?: string): Promise<{
    authorizationUrl: string;
    state: string;
  }> {
    const tenantId = this.configService.getOrThrow('auth.entraTenantId', {
      infer: true,
    });
    const clientId = this.configService.getOrThrow('auth.entraClientId', {
      infer: true,
    });
    const redirectUri = this.getRedirectUri();

    const state = this.base64UrlEncode(crypto.randomBytes(32));
    const nonce = this.base64UrlEncode(crypto.randomBytes(32));
    const codeVerifier = this.base64UrlEncode(crypto.randomBytes(32));
    const codeChallenge = this.base64UrlEncode(
      crypto.createHash('sha256').update(codeVerifier).digest(),
    );

    const payload: StoredOAuthState = {
      codeVerifier,
      nonce,
      returnTo: this.sanitizeReturnTo(returnTo),
    };

    await this.redisService.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      JSON.stringify(payload),
      OAUTH_STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });

    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    return { authorizationUrl, state };
  }

  async exchangeCodeForIdToken(
    code: string,
    state: string,
  ): Promise<{ idToken: string; nonce: string; returnTo: string }> {
    const codeCacheKey = `${OAUTH_CODE_PREFIX}${this.hashValue(code)}`;
    const cachedResult = await this.redisService.get(codeCacheKey);
    if (cachedResult) {
      try {
        return JSON.parse(cachedResult) as {
          idToken: string;
          nonce: string;
          returnTo: string;
        };
      } catch {
        await this.redisService.del(codeCacheKey);
      }
    }

    // Read state first; only delete after a successful token exchange so a
    // transient Microsoft network failure can be retried with the same code/state.
    const stored = await this.readOAuthState(state);
    if (!stored) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tenantId = this.configService.getOrThrow('auth.entraTenantId', {
      infer: true,
    });
    const clientId = this.configService.getOrThrow('auth.entraClientId', {
      infer: true,
    });
    const clientSecret = this.configService.getOrThrow('auth.entraClientSecret', {
      infer: true,
    });
    const redirectUri = this.getRedirectUri();

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: stored.codeVerifier,
    }).toString();

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    let tokenResponse: EntraTokenResponse | null = null;
    let lastNetworkError: unknown;

    for (let attempt = 1; attempt <= TOKEN_EXCHANGE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await httpsFormPost(tokenUrl, body, {
          timeoutMs: 20_000,
          family: 4,
        });
        try {
          tokenResponse = JSON.parse(response.text) as EntraTokenResponse;
        } catch {
          tokenResponse = {
            error: 'invalid_response',
            error_description: `Microsoft token endpoint returned non-JSON (HTTP ${response.status})`,
          };
        }

        if (response.status >= 200 && response.status < 300 && tokenResponse.id_token) {
          break;
        }

        // Non-retryable OAuth errors (bad code / client / redirect).
        if (response.status >= 400 && response.status < 500) {
          throw new UnauthorizedException(
            tokenResponse.error_description ||
              tokenResponse.error ||
              'Microsoft token exchange failed',
          );
        }

        lastNetworkError = new Error(
          `Microsoft token endpoint HTTP ${response.status}`,
        );
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        lastNetworkError = error;
        this.logger.warn(
          `Microsoft token exchange network failure (attempt ${attempt}/${TOKEN_EXCHANGE_MAX_ATTEMPTS}): ${this.formatNetworkError(error)}`,
        );
      }

      if (attempt < TOKEN_EXCHANGE_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }

    if (!tokenResponse?.id_token) {
      throw new UnauthorizedException(
        lastNetworkError
          ? `Microsoft token exchange network error: ${this.formatNetworkError(lastNetworkError)}`
          : tokenResponse?.error_description ||
              tokenResponse?.error ||
              'Microsoft token exchange failed',
      );
    }

    const result = {
      idToken: tokenResponse.id_token,
      nonce: stored.nonce,
      returnTo: stored.returnTo,
    };

    await this.redisService.del(`${OAUTH_STATE_PREFIX}${state}`);
    await this.redisService.set(
      codeCacheKey,
      JSON.stringify(result),
      OAUTH_CODE_TTL_SECONDS,
    );

    return result;
  }

  getFrontendCallbackUrl(returnTo: string, error?: string): string {
    const frontendDomain =
      this.configService.get('app.frontendDomain', { infer: true }) ??
      'http://localhost:3000';
    const locale = this.resolveLocaleFromPath(returnTo);
    const normalizedReturnTo = this.sanitizeReturnTo(returnTo);
    const url = new URL(`/${locale}/auth/callback`, frontendDomain);
    url.searchParams.set('returnTo', normalizedReturnTo);
    if (error) {
      url.searchParams.set('error', error);
    }
    return url.toString();
  }

  private resolveLocaleFromPath(path?: string): string {
    const match = path?.match(/^\/(en|ar)(?=\/|$)/);
    return match?.[1] ?? 'en';
  }

  private async readOAuthState(
    state: string,
  ): Promise<StoredOAuthState | null> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const raw = await this.redisService.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredOAuthState;
    } catch {
      return null;
    }
  }

  private formatNetworkError(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error);
    }
    const cause = (error as Error & { cause?: { code?: string; message?: string } })
      .cause;
    const causeBit = cause?.code || cause?.message;
    return causeBit ? `${error.message} (${causeBit})` : error.message;
  }

  private getRedirectUri(): string {
    const configured = this.configService.get('auth.entraRedirectUri', {
      infer: true,
    });
    if (configured) return configured;

    const backendDomain = this.configService
      .getOrThrow('app.backendDomain', { infer: true })
      .replace(/\/$/, '');
    const apiPrefix = this.configService.getOrThrow('app.apiPrefix', {
      infer: true,
    });

    return `${backendDomain}/${apiPrefix}/v1/auth/entra/callback`;
  }

  private sanitizeReturnTo(returnTo?: string): string {
    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
      return '/dashboard';
    }

    const withoutLocale = returnTo.replace(/^\/(en|ar)(?=\/|$)/, '') || '/dashboard';
    if (withoutLocale === '/' || withoutLocale === '') {
      return '/dashboard';
    }

    return withoutLocale.startsWith('/') ? withoutLocale : `/${withoutLocale}`;
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
