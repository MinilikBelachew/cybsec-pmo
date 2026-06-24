export type AuthLoginContext = {
  ipAddress: string;
  userAgent: string | null;
};

export type AuthLoginFailureReason =
  | 'INVALID_TOKEN'
  | 'MISSING_EMAIL'
  | 'INACTIVE_USER'
  | 'RATE_LIMITED'
  | 'ACCOUNT_LOCKED';
