import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { KekaConfig } from './keka-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  KEKA_MOCK_ENABLED: string;

  @IsString()
  @IsOptional()
  KEKA_AUTH_URL: string;

  @IsString()
  @IsOptional()
  KEKA_API_BASE_URL: string;

  @IsString()
  @IsOptional()
  KEKA_CLIENT_ID: string;

  @IsString()
  @IsOptional()
  KEKA_CLIENT_SECRET: string;

  @IsString()
  @IsOptional()
  KEKA_API_KEY: string;

  @IsString()
  @IsOptional()
  KEKA_COMPANY_SUBDOMAIN: string;

  @IsString()
  @IsOptional()
  KEKA_SYNC_CRON: string;

  @IsString()
  @IsOptional()
  KEKA_SYNC_ENABLED: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }

  return value === 'true' || value === '1';
}

function normalizeCompanySubdomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'kekademo';
  }

  if (trimmed.includes('.')) {
    return trimmed.split('.')[0] ?? trimmed;
  }

  return trimmed;
}

function resolveKekaUrls(
  mockEnabled: boolean,
  appPort: string,
  companySubdomain: string,
): { authUrl: string; apiBaseUrl: string } {
  const loopbackBase = `http://127.0.0.1:${appPort}`;

  if (mockEnabled) {
    return {
      authUrl:
        process.env.KEKA_AUTH_URL ??
        `${loopbackBase}/keka-mock/connect/token`,
      apiBaseUrl:
        process.env.KEKA_API_BASE_URL ??
        `${loopbackBase}/keka-mock/api/v1`,
    };
  }

  const subdomain = normalizeCompanySubdomain(companySubdomain);
  const sandbox =
    parseBoolean(process.env.KEKA_SANDBOX, true) ||
    (process.env.KEKA_AUTH_URL?.includes('kekademo') ?? false);

  const authUrl =
    process.env.KEKA_AUTH_URL ??
    (sandbox
      ? 'https://login.kekademo.com/connect/token'
      : 'https://login.keka.com/connect/token');

  const apiBaseUrl =
    process.env.KEKA_API_BASE_URL ??
    (sandbox
      ? `https://${subdomain}.kekademo.com/api/v1`
      : `https://${subdomain}.keka.com/api/v1`);

  return { authUrl, apiBaseUrl };
}

export default registerAs<KekaConfig>('keka', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const mockEnabled =
    parseBoolean(process.env.KEKA_MOCK_ENABLED, false) &&
    process.env.NODE_ENV !== 'production';
  const appPort = process.env.APP_PORT ?? '6001';
  const companySubdomain = process.env.KEKA_COMPANY_SUBDOMAIN ?? 'kekademo';
  const { authUrl, apiBaseUrl } = resolveKekaUrls(
    mockEnabled,
    appPort,
    companySubdomain,
  );

  return {
    mockEnabled,
    authUrl,
    apiBaseUrl,
    clientId: process.env.KEKA_CLIENT_ID ?? 'mock-client-id',
    clientSecret: process.env.KEKA_CLIENT_SECRET ?? 'mock-client-secret',
    apiKey: process.env.KEKA_API_KEY ?? 'mock-api-key',
    companySubdomain: normalizeCompanySubdomain(companySubdomain),
    syncCron: process.env.KEKA_SYNC_CRON ?? '0 2 * * *',
    syncEnabled: parseBoolean(process.env.KEKA_SYNC_ENABLED, true),
  };
});
