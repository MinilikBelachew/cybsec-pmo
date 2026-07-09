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

export default registerAs<KekaConfig>('keka', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const mockEnabled =
    parseBoolean(process.env.KEKA_MOCK_ENABLED, false) &&
    process.env.NODE_ENV !== 'production';
  const appPort = process.env.APP_PORT ?? '6001';
  const loopbackBase = `http://127.0.0.1:${appPort}`;

  return {
    mockEnabled,
    authUrl:
      process.env.KEKA_AUTH_URL ??
      (mockEnabled
        ? `${loopbackBase}/keka-mock/connect/token`
        : 'https://login.kekademo.com/connect/token'),
    apiBaseUrl:
      process.env.KEKA_API_BASE_URL ??
      (mockEnabled
        ? `${loopbackBase}/keka-mock/api/v1`
        : 'https://kekademo.keka.com/api/v1'),
    clientId: process.env.KEKA_CLIENT_ID ?? 'mock-client-id',
    clientSecret: process.env.KEKA_CLIENT_SECRET ?? 'mock-client-secret',
    apiKey: process.env.KEKA_API_KEY ?? 'mock-api-key',
    companySubdomain: process.env.KEKA_COMPANY_SUBDOMAIN ?? 'kekademo',
    syncCron: process.env.KEKA_SYNC_CRON ?? '*/15 * * * *',
    syncEnabled: parseBoolean(process.env.KEKA_SYNC_ENABLED, true),
  };
});
