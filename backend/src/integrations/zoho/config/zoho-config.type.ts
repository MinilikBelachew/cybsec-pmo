export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
  dc: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  /** Zoho Books organization_id (required for /books/v3 calls). */
  booksOrganizationId: string;
  crmSyncEnabled: boolean;
  booksSyncEnabled: boolean;
};
