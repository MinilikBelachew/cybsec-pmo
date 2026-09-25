import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../../../utils/validate-config';
import { parseZohoSyncEnabled } from '../zoho.constants';
import { ZohoConfig } from './zoho-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  ZOHO_CLIENT_ID: string;

  @IsString()
  @IsOptional()
  ZOHO_CLIENT_SECRET: string;

  @IsString()
  @IsOptional()
  ZOHO_REFRESH_TOKEN: string;

  @IsString()
  @IsOptional()
  ZOHO_REDIRECT_URI: string;

  @IsString()
  @IsOptional()
  ZOHO_DC: string;

  @IsString()
  @IsOptional()
  ZOHO_BOOKS_ORGANIZATION_ID: string;
}

/** Map Zoho data-center code → accounts + API hosts. */
function hostsForDc(dc: string): { accountsBaseUrl: string; apiBaseUrl: string } {
  const normalized = (dc || 'com').trim().toLowerCase();
  switch (normalized) {
    case 'eu':
      return {
        accountsBaseUrl: 'https://accounts.zoho.eu',
        apiBaseUrl: 'https://www.zohoapis.eu',
      };
    case 'in':
      return {
        accountsBaseUrl: 'https://accounts.zoho.in',
        apiBaseUrl: 'https://www.zohoapis.in',
      };
    case 'au':
      return {
        accountsBaseUrl: 'https://accounts.zoho.com.au',
        apiBaseUrl: 'https://www.zohoapis.com.au',
      };
    case 'jp':
      return {
        accountsBaseUrl: 'https://accounts.zoho.jp',
        apiBaseUrl: 'https://www.zohoapis.jp',
      };
    case 'ca':
      return {
        accountsBaseUrl: 'https://accounts.zohocloud.ca',
        apiBaseUrl: 'https://www.zohoapis.ca',
      };
    case 'com':
    case 'us':
    default:
      return {
        accountsBaseUrl: 'https://accounts.zoho.com',
        apiBaseUrl: 'https://www.zohoapis.com',
      };
  }
}

export default registerAs<ZohoConfig>('zoho', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const dc = process.env.ZOHO_DC?.trim() || 'com';
  const { accountsBaseUrl, apiBaseUrl } = hostsForDc(dc);

  return {
    clientId: process.env.ZOHO_CLIENT_ID?.trim() || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET?.trim() || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN?.trim() || '',
    redirectUri:
      process.env.ZOHO_REDIRECT_URI?.trim() ||
      'http://localhost:3001/api/v1/integrations/zoho/callback',
    dc,
    accountsBaseUrl,
    apiBaseUrl,
    booksOrganizationId:
      process.env.ZOHO_BOOKS_ORGANIZATION_ID?.trim() || '',
    crmSyncEnabled: parseZohoSyncEnabled(
      process.env.ZOHO_CRM_SYNC_ENABLED,
      true,
    ),
    booksSyncEnabled: parseZohoSyncEnabled(
      process.env.ZOHO_BOOKS_SYNC_ENABLED,
      true,
    ),
  };
});
