import { KekaConfig } from '../config/keka-config.type';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

export function normalizeCompanySubdomain(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return 'kekademo';
  }
  if (trimmed.includes('.')) {
    return trimmed.split('.')[0] ?? trimmed;
  }
  return trimmed;
}

export type KekaUrlResolutionInput = {
  mockEnabled: boolean;
  appPort: string;
  companySubdomain: string;
  sandbox: boolean;
  authUrlOverride?: string | null;
  apiBaseUrlOverride?: string | null;
};

export function resolveKekaUrls(input: KekaUrlResolutionInput): {
  authUrl: string;
  apiBaseUrl: string;
} {
  const {
    mockEnabled,
    appPort,
    companySubdomain,
    sandbox,
    authUrlOverride,
    apiBaseUrlOverride,
  } = input;

  if (authUrlOverride?.trim() && apiBaseUrlOverride?.trim()) {
    return {
      authUrl: authUrlOverride.trim(),
      apiBaseUrl: apiBaseUrlOverride.trim(),
    };
  }

  const loopbackBase = `http://127.0.0.1:${appPort}`;

  if (mockEnabled) {
    return {
      authUrl: authUrlOverride?.trim() || `${loopbackBase}/keka-mock/connect/token`,
      apiBaseUrl:
        apiBaseUrlOverride?.trim() || `${loopbackBase}/keka-mock/api/v1`,
    };
  }

  const subdomain = normalizeCompanySubdomain(companySubdomain);
  const authUrl =
    authUrlOverride?.trim() ||
    (sandbox
      ? 'https://login.kekademo.com/connect/token'
      : 'https://login.keka.com/connect/token');
  const apiBaseUrl =
    apiBaseUrlOverride?.trim() ||
    (sandbox
      ? `https://${subdomain}.kekademo.com/api/v1`
      : `https://${subdomain}.keka.com/api/v1`);

  return { authUrl, apiBaseUrl };
}

export function envKekaConfigBase(): Omit<
  KekaConfig,
  'authUrl' | 'apiBaseUrl' | 'clientId' | 'clientSecret' | 'apiKey' | 'companySubdomain'
> & {
  companySubdomain: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  sandbox: boolean;
} {
  const mockEnabled =
    parseBoolean(process.env.KEKA_MOCK_ENABLED, false) &&
    process.env.NODE_ENV !== 'production';

  return {
    mockEnabled,
    companySubdomain: normalizeCompanySubdomain(
      process.env.KEKA_COMPANY_SUBDOMAIN ?? 'kekademo',
    ),
    clientId: process.env.KEKA_CLIENT_ID ?? 'mock-client-id',
    clientSecret: process.env.KEKA_CLIENT_SECRET ?? 'mock-client-secret',
    apiKey: process.env.KEKA_API_KEY ?? 'mock-api-key',
    sandbox: parseBoolean(process.env.KEKA_SANDBOX, true),
    syncCron: process.env.KEKA_SYNC_CRON ?? '0 2 * * *',
    syncEnabled: parseBoolean(process.env.KEKA_SYNC_ENABLED, true),
  };
}
