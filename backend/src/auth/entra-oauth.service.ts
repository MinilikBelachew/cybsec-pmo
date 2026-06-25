import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { AllConfigType } from '../config/config.type';
import { RedisService } from '../redis/redis.service';

const OAUTH_STATE_TTL_SECONDS = 600;
const OAUTH_STATE_PREFIX = 'entra:oauth:';

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
    const stored = await this.consumeOAuthState(state);
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
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    const tokenResponse = (await response.json()) as EntraTokenResponse;

    if (!response.ok || !tokenResponse.id_token) {
      throw new UnauthorizedException(
        tokenResponse.error_description || 'Microsoft token exchange failed',
      );
    }

    return {
      idToken: tokenResponse.id_token,
      nonce: stored.nonce,
      returnTo: stored.returnTo,
    };
  }

  getFrontendCallbackUrl(returnTo: string, error?: string): string {
    const frontendDomain =
      this.configService.get('app.frontendDomain', { infer: true }) ??
      'http://localhost:3000';
    const url = new URL('/en/auth/callback', frontendDomain);
    url.searchParams.set('returnTo', returnTo);
    if (error) {
      url.searchParams.set('error', error);
    }
    return url.toString();
  }

  private async consumeOAuthState(
    state: string,
  ): Promise<StoredOAuthState | null> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const raw = await this.redisService.get(key);
    await this.redisService.del(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredOAuthState;
    } catch {
      return null;
    }
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
    return returnTo;
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
