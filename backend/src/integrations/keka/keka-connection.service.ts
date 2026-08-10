import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KekaConfig } from './config/keka-config.type';
import {
  decryptSecret,
  encryptSecret,
  maskSecretValue,
} from './utils/integration-secrets.util';
import {
  envKekaConfigBase,
  normalizeCompanySubdomain,
  resolveKekaUrls,
} from './utils/keka-url.util';
import {
  KekaConnectionResponseDto,
  KekaConnectionSecretsDto,
  KekaConnectionTestResultDto,
  UpdateKekaConnectionDto,
} from './dto/keka-connection.dto';

const SETTINGS_ID = 'default';

type DbSecrets = {
  clientId: string | null;
  clientSecret: string | null;
  apiKey: string | null;
};

@Injectable()
export class KekaConnectionService {
  private readonly logger = new Logger(KekaConnectionService.name);
  private tokenCacheClearListeners: Array<() => void> = [];

  constructor(private readonly prisma: PrismaService) {}

  onTokenCacheClear(listener: () => void): void {
    this.tokenCacheClearListeners.push(listener);
  }

  clearTokenCaches(): void {
    for (const listener of this.tokenCacheClearListeners) {
      try {
        listener();
      } catch (error) {
        this.logger.warn(
          `Token cache clear listener failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async getConnectionView(): Promise<KekaConnectionResponseDto> {
    const row = await this.prisma.kekaConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const secrets = this.decryptRowSecrets(row);
    const envBase = envKekaConfigBase();
    const effective = await this.getEffectiveConfig();
    const hasDbRow = Boolean(row);
    const hasDbSecrets = Boolean(
      secrets.clientId || secrets.clientSecret || secrets.apiKey,
    );

    return {
      companySubdomain: row?.companySubdomain ?? envBase.companySubdomain,
      sandbox: row?.sandbox ?? envBase.sandbox,
      authUrl: row?.authUrl ?? null,
      apiBaseUrl: row?.apiBaseUrl ?? null,
      clientIdMasked: maskSecretValue(
        secrets.clientId ?? (hasDbSecrets ? null : envBase.clientId),
      ),
      hasClientId: Boolean(
        secrets.clientId || (!hasDbSecrets && envBase.clientId),
      ),
      hasClientSecret: Boolean(
        secrets.clientSecret || (!hasDbSecrets && envBase.clientSecret),
      ),
      hasApiKey: Boolean(secrets.apiKey || (!hasDbSecrets && envBase.apiKey)),
      source: hasDbRow && hasDbSecrets ? 'database' : hasDbRow ? 'mixed' : 'env',
      configured: Boolean(
        effective.clientId && effective.clientSecret && effective.apiKey,
      ),
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestStatus: (row?.lastTestStatus as 'ok' | 'failed' | null) ?? null,
      lastTestError: row?.lastTestError ?? null,
      updatedAt: row?.updatedAt ?? null,
      effectiveAuthUrl: effective.authUrl,
      effectiveApiBaseUrl: effective.apiBaseUrl,
    };
  }

  /** Plain secrets — only for configure users via the reveal endpoint. */
  async getConnectionSecrets(): Promise<KekaConnectionSecretsDto> {
    const effective = await this.getEffectiveConfig();
    return {
      clientId: effective.clientId || null,
      clientSecret: effective.clientSecret || null,
      apiKey: effective.apiKey || null,
    };
  }

  async updateConnection(
    dto: UpdateKekaConnectionDto,
    actorId: string,
  ): Promise<KekaConnectionResponseDto> {
    const existing = await this.prisma.kekaConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const existingSecrets = this.decryptRowSecrets(existing);

    const nextClientId = this.resolveSecretUpdate(
      dto.clientId,
      existingSecrets.clientId,
    );
    const nextClientSecret = this.resolveSecretUpdate(
      dto.clientSecret,
      existingSecrets.clientSecret,
    );
    const nextApiKey = this.resolveSecretUpdate(
      dto.apiKey,
      existingSecrets.apiKey,
    );

    const companySubdomain =
      dto.companySubdomain !== undefined
        ? normalizeCompanySubdomain(dto.companySubdomain)
        : (existing?.companySubdomain ?? null);

    const sandbox =
      dto.sandbox !== undefined ? dto.sandbox : (existing?.sandbox ?? true);

    const authUrl =
      dto.authUrl !== undefined
        ? dto.authUrl?.trim() || null
        : (existing?.authUrl ?? null);
    const apiBaseUrl =
      dto.apiBaseUrl !== undefined
        ? dto.apiBaseUrl?.trim() || null
        : (existing?.apiBaseUrl ?? null);

    await this.prisma.kekaConnectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        companySubdomain,
        sandbox,
        authUrl,
        apiBaseUrl,
        clientIdEncrypted: nextClientId ? encryptSecret(nextClientId) : null,
        clientSecretEncrypted: nextClientSecret
          ? encryptSecret(nextClientSecret)
          : null,
        apiKeyEncrypted: nextApiKey ? encryptSecret(nextApiKey) : null,
        updatedById: actorId,
      },
      update: {
        companySubdomain,
        sandbox,
        authUrl,
        apiBaseUrl,
        clientIdEncrypted: nextClientId ? encryptSecret(nextClientId) : null,
        clientSecretEncrypted: nextClientSecret
          ? encryptSecret(nextClientSecret)
          : null,
        apiKeyEncrypted: nextApiKey ? encryptSecret(nextApiKey) : null,
        updatedById: actorId,
      },
    });

    this.clearTokenCaches();
    return this.getConnectionView();
  }

  async testConnection(
    actorId: string,
    dto?: UpdateKekaConnectionDto,
  ): Promise<KekaConnectionTestResultDto> {
    // Persist draft first when body provided so test uses the same effective config.
    if (dto && Object.keys(dto).length > 0) {
      await this.updateConnection(dto, actorId);
    }

    const config = await this.getEffectiveConfig();
    const now = new Date();

    try {
      await this.exchangeToken(config);
      await this.prisma.kekaConnectionSettings.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          lastTestedAt: now,
          lastTestStatus: 'ok',
          lastTestError: null,
          updatedById: actorId,
        },
        update: {
          lastTestedAt: now,
          lastTestStatus: 'ok',
          lastTestError: null,
          updatedById: actorId,
        },
      });
      this.clearTokenCaches();
      return {
        success: true,
        message: 'Keka authentication succeeded.',
        testedAt: now,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Keka authentication failed.';
      await this.prisma.kekaConnectionSettings.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          lastTestedAt: now,
          lastTestStatus: 'failed',
          lastTestError: message,
          updatedById: actorId,
        },
        update: {
          lastTestedAt: now,
          lastTestStatus: 'failed',
          lastTestError: message,
          updatedById: actorId,
        },
      });
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message,
        errors: { connection: 'testFailed' },
      });
    }
  }

  async getEffectiveConfig(): Promise<KekaConfig> {
    const envBase = envKekaConfigBase();
    const appPort = process.env.APP_PORT ?? '6001';
    const row = await this.prisma.kekaConnectionSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const secrets = this.decryptRowSecrets(row);

    const companySubdomain = normalizeCompanySubdomain(
      row?.companySubdomain || envBase.companySubdomain,
    );
    const sandbox = row?.sandbox ?? envBase.sandbox;
    const { authUrl, apiBaseUrl } = resolveKekaUrls({
      mockEnabled: envBase.mockEnabled,
      appPort,
      companySubdomain,
      sandbox,
      authUrlOverride: row?.authUrl || process.env.KEKA_AUTH_URL || null,
      apiBaseUrlOverride:
        row?.apiBaseUrl || process.env.KEKA_API_BASE_URL || null,
    });

    return {
      mockEnabled: envBase.mockEnabled,
      authUrl,
      apiBaseUrl,
      clientId: secrets.clientId || envBase.clientId,
      clientSecret: secrets.clientSecret || envBase.clientSecret,
      apiKey: secrets.apiKey || envBase.apiKey,
      companySubdomain,
      syncCron: envBase.syncCron,
      syncEnabled: envBase.syncEnabled,
    };
  }

  async exchangeToken(
    config?: KekaConfig,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const effective = config ?? (await this.getEffectiveConfig());
    const body = new URLSearchParams({
      grant_type: 'kekaapi',
      client_id: effective.clientId,
      client_secret: effective.clientSecret,
      api_key: effective.apiKey,
      scope: 'kekaapi',
    });

    const response = await fetch(effective.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Keka auth failed (${response.status}): ${text}`);
      throw new Error(
        `Keka authentication failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in ?? 3600,
    };
  }

  private decryptRowSecrets(
    row: {
      clientIdEncrypted: string | null;
      clientSecretEncrypted: string | null;
      apiKeyEncrypted: string | null;
    } | null,
  ): DbSecrets {
    if (!row) {
      return { clientId: null, clientSecret: null, apiKey: null };
    }
    return {
      clientId: this.safeDecrypt(row.clientIdEncrypted),
      clientSecret: this.safeDecrypt(row.clientSecretEncrypted),
      apiKey: this.safeDecrypt(row.apiKeyEncrypted),
    };
  }

  private safeDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return decryptSecret(value);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt Keka secret: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /** Empty / omitted keeps existing; whitespace-only clears. */
  private resolveSecretUpdate(
    incoming: string | undefined,
    existing: string | null,
  ): string | null {
    if (incoming === undefined) {
      return existing;
    }
    const trimmed = incoming.trim();
    if (trimmed === '') {
      return existing;
    }
    return trimmed;
  }
}
