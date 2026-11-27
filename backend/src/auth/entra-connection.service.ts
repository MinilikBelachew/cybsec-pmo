import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import https from 'https';
import { AllConfigType } from '../config/config.type';
import { PrismaService } from '../database/prisma.service';
import {
  decryptSecret,
  encryptSecret,
  maskSecretValue,
} from '../common/utils/integration-secrets.util';
import { httpsFormPost } from './utils/https-form-post.util';
import {
  EntraConnectionResponseDto,
  EntraConnectionTestResultDto,
  UpdateEntraConnectionDto,
} from './dto/entra-connection.dto';

const SETTINGS_ID = 'default';

export type EffectiveEntraConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type DbEntraSecrets = {
  clientId: string | null;
  clientSecret: string | null;
};

@Injectable()
export class EntraConnectionService {
  private readonly logger = new Logger(EntraConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  getDefaultRedirectUri(): string {
    const backendDomain = (
      this.configService.get('app.backendDomain', { infer: true }) ??
      'http://localhost:3001'
    ).replace(/\/$/, '');
    const apiPrefix =
      this.configService.get('app.apiPrefix', { infer: true }) ?? 'api';
    return `${backendDomain}/${apiPrefix}/v1/auth/entra/callback`;
  }

  async getEffectiveConfig(): Promise<EffectiveEntraConfig> {
    const row = await this.prisma.entraConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const secrets = this.decryptRowSecrets(row);

    const envTenantId =
      this.configService.get('auth.entraTenantId', { infer: true })?.trim() ||
      '';
    const envClientId =
      this.configService.get('auth.entraClientId', { infer: true })?.trim() ||
      '';
    const envClientSecret =
      this.configService
        .get('auth.entraClientSecret', { infer: true })
        ?.trim() || '';
    const envRedirectUri =
      this.configService
        .get('auth.entraRedirectUri', { infer: true })
        ?.trim() || '';

    const tenantId = row?.tenantId?.trim() || envTenantId;
    const clientId = secrets.clientId || envClientId;
    const clientSecret = secrets.clientSecret || envClientSecret;
    const redirectUri =
      row?.redirectUri?.trim() || envRedirectUri || this.getDefaultRedirectUri();

    return {
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
    };
  }

  async isConfigured(): Promise<boolean> {
    const cfg = await this.getEffectiveConfig();
    return Boolean(cfg.tenantId && cfg.clientId && cfg.clientSecret);
  }

  async getConnectionView(): Promise<EntraConnectionResponseDto> {
    const row = await this.prisma.entraConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const secrets = this.decryptRowSecrets(row);
    const effective = await this.getEffectiveConfig();

    const envTenantId =
      this.configService.get('auth.entraTenantId', { infer: true })?.trim() ||
      null;
    const envClientId =
      this.configService.get('auth.entraClientId', { infer: true })?.trim() ||
      null;
    const envClientSecret =
      this.configService
        .get('auth.entraClientSecret', { infer: true })
        ?.trim() || null;

    const hasDbRow = Boolean(row);
    const hasDbCreds = Boolean(
      row?.tenantId || secrets.clientId || secrets.clientSecret,
    );
    const hasEnvCreds = Boolean(envTenantId || envClientId || envClientSecret);

    let source: 'database' | 'env' | 'mixed' | 'none' = 'none';
    if (hasDbRow && hasDbCreds) {
      source =
        row?.tenantId && secrets.clientId && secrets.clientSecret
          ? 'database'
          : 'mixed';
    } else if (hasEnvCreds) {
      source = 'env';
    }

    return {
      tenantId: effective.tenantId || null,
      clientIdMasked: maskSecretValue(effective.clientId || null),
      hasClientId: Boolean(effective.clientId),
      hasClientSecret: Boolean(effective.clientSecret),
      redirectUri: row?.redirectUri ?? null,
      effectiveRedirectUri: effective.redirectUri,
      source,
      configured: Boolean(
        effective.tenantId && effective.clientId && effective.clientSecret,
      ),
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestStatus: (row?.lastTestStatus as 'ok' | 'failed' | null) ?? null,
      lastTestError: row?.lastTestError ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async updateConnection(
    dto: UpdateEntraConnectionDto,
    actorId: string | null,
  ): Promise<EntraConnectionResponseDto> {
    const existing = await this.prisma.entraConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const existingSecrets = this.decryptRowSecrets(existing);

    const tenantId =
      dto.tenantId !== undefined
        ? dto.tenantId.trim() || null
        : (existing?.tenantId ?? null);

    const nextClientId = this.resolveSecretUpdate(
      dto.clientId,
      existingSecrets.clientId,
    );
    const nextClientSecret = this.resolveSecretUpdate(
      dto.clientSecret,
      existingSecrets.clientSecret,
    );

    const redirectUri =
      dto.redirectUri !== undefined
        ? dto.redirectUri?.trim() || null
        : (existing?.redirectUri ?? null);

    await this.prisma.entraConnectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        tenantId,
        clientIdEncrypted: nextClientId ? encryptSecret(nextClientId) : null,
        clientSecretEncrypted: nextClientSecret
          ? encryptSecret(nextClientSecret)
          : null,
        redirectUri,
        updatedById: actorId,
      },
      update: {
        tenantId,
        clientIdEncrypted: nextClientId ? encryptSecret(nextClientId) : null,
        clientSecretEncrypted: nextClientSecret
          ? encryptSecret(nextClientSecret)
          : null,
        redirectUri,
        updatedById: actorId,
      },
    });

    return this.getConnectionView();
  }

  async testConnection(
    actorId: string | null,
    dto?: UpdateEntraConnectionDto,
  ): Promise<EntraConnectionTestResultDto> {
    const saved = await this.getEffectiveConfig();
    const effective: EffectiveEntraConfig = {
      tenantId: dto?.tenantId?.trim() || saved.tenantId,
      clientId: dto?.clientId?.trim() || saved.clientId,
      clientSecret: dto?.clientSecret?.trim() || saved.clientSecret,
      redirectUri: dto?.redirectUri?.trim() || saved.redirectUri,
    };

    if (!effective.tenantId || !effective.clientId || !effective.clientSecret) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message:
          'Tenant ID, Client ID, and Client Secret are all required to test Entra ID.',
        errors: { connection: 'incompleteCredentials' },
      });
    }

    const now = new Date();
    try {
      await this.verifyWithMicrosoft(effective);
      await this.recordTestStatus(now, 'ok', null, actorId);
      return {
        success: true,
        message: 'Microsoft Entra ID tenant and app credentials verified.',
        testedAt: now,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Microsoft Entra ID verification failed.';
      await this.recordTestStatus(now, 'failed', message, actorId);
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message,
        errors: { connection: 'testFailed' },
      });
    }
  }

  private async verifyWithMicrosoft(config: EffectiveEntraConfig): Promise<void> {
    const encodedTenant = encodeURIComponent(config.tenantId);

    // 1. Validate OpenID Connect discovery document for the tenant.
    const discoveryUrl = `https://login.microsoftonline.com/${encodedTenant}/v2.0/.well-known/openid-configuration`;
    const discovery = await this.httpsGetJson(discoveryUrl, 15_000);
    if (discovery.status < 200 || discovery.status >= 300) {
      throw new Error(
        `Tenant ID "${config.tenantId}" could not be resolved in Microsoft Entra ID (HTTP ${discovery.status}).`,
      );
    }

    // 2. Validate client_id + client_secret against the v2.0 token endpoint.
    const tokenUrl = `https://login.microsoftonline.com/${encodedTenant}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }).toString();

    const response = await httpsFormPost(tokenUrl, body, {
      timeoutMs: 15_000,
      family: 4,
    });

    if (response.status >= 200 && response.status < 300) {
      return;
    }

    let parsed: {
      error?: string;
      error_description?: string;
      error_codes?: number[];
    } = {};
    try {
      parsed = JSON.parse(response.text) as typeof parsed;
    } catch {
      throw new Error(
        `Microsoft token endpoint returned HTTP ${response.status}.`,
      );
    }

    const codes = parsed.error_codes ?? [];
    if (codes.includes(7000215)) {
      throw new Error(
        'Invalid Microsoft Client Secret. Make sure you pasted the Secret Value (not the Secret ID).',
      );
    }
    if (codes.includes(7000222)) {
      throw new Error(
        'The Microsoft Client Secret has expired. Create a new secret in Azure App Registrations.',
      );
    }
    if (codes.includes(700016)) {
      throw new Error(
        'Application (Client ID) was not found in this Microsoft Entra ID tenant.',
      );
    }
    if (codes.includes(90002) || codes.includes(900023)) {
      throw new Error(
        'Tenant ID was not found in Microsoft Entra ID. Check your Directory (tenant) ID.',
      );
    }
    if (codes.includes(7000112)) {
      throw new Error(
        'This Microsoft Entra ID application is currently disabled.',
      );
    }

    const firstLine = parsed.error_description?.split(/\r?\n/)[0]?.trim();
    throw new Error(
      firstLine ||
        parsed.error ||
        `Microsoft Entra ID rejected the credentials (HTTP ${response.status}).`,
    );
  }

  private httpsGetJson(
    urlString: string,
    timeoutMs: number,
  ): Promise<{ status: number; text: string }> {
    const url = new URL(urlString);
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : 443,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          family: 4,
          headers: { Accept: 'application/json' },
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
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async recordTestStatus(
    now: Date,
    status: 'ok' | 'failed',
    errorMessage: string | null,
    actorId: string | null,
  ): Promise<void> {
    await this.prisma.entraConnectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        lastTestedAt: now,
        lastTestStatus: status,
        lastTestError: errorMessage,
        updatedById: actorId,
      },
      update: {
        lastTestedAt: now,
        lastTestStatus: status,
        lastTestError: errorMessage,
        ...(actorId ? { updatedById: actorId } : {}),
      },
    });
  }

  private decryptRowSecrets(
    row: {
      clientIdEncrypted: string | null;
      clientSecretEncrypted: string | null;
    } | null,
  ): DbEntraSecrets {
    if (!row) {
      return { clientId: null, clientSecret: null };
    }
    return {
      clientId: this.safeDecrypt(row.clientIdEncrypted),
      clientSecret: this.safeDecrypt(row.clientSecretEncrypted),
    };
  }

  private safeDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return decryptSecret(value);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt Entra secret: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private resolveSecretUpdate(
    incoming: string | undefined,
    existing: string | null,
  ): string | null {
    if (incoming === undefined) return existing;
    const trimmed = incoming.trim();
    if (trimmed === '') return existing;
    return trimmed;
  }
}
