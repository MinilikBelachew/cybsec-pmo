export const ZOHO_INTEGRATION = 'zoho_crm';
export const ZOHO_ENTITY_TYPE = {
  OPPORTUNITY: 'opportunity',
} as const;

export const ZOHO_SYNC_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const ZOHO_HTTP_TIMEOUT_MS = 30_000;
/** Refresh access token this many ms before Zoho's expires_in. */
export const ZOHO_TOKEN_EXPIRY_SKEW_MS = 60_000;
