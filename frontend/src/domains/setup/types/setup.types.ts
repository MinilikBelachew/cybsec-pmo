export type SetupStatus = {
  setupCompleted: boolean;
  setupRequired: boolean;
  redirectToSetup: boolean;
  entraConfigured: boolean;
  mailConfigured: boolean;
  kekaConfigured: boolean;
  hasSuperAdmin: boolean;
  setupCompletedAt: string | null;
};

export type EntraConnectionView = {
  tenantId: string | null;
  clientIdMasked: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  redirectUri: string | null;
  effectiveRedirectUri: string;
  source: "database" | "env" | "mixed" | "none";
  configured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "ok" | "failed" | null;
  lastTestError: string | null;
  updatedAt: string | null;
};

export type UpdateEntraConnectionPayload = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string | null;
};

export type SaveSetupEntraPayload = UpdateEntraConnectionPayload & {
  superAdminEmail?: string;
  superAdminName?: string;
};

export type EntraTestResult = {
  success: boolean;
  message: string;
  testedAt: string;
};

export type MailConnectionView = {
  sendgridEnabled: boolean;
  sendgridApiKeyMasked: string | null;
  hasSendgridApiKey: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpSecure: boolean;
  smtpIgnoreTls: boolean;
  smtpRequireTls: boolean;
  defaultEmail: string | null;
  defaultName: string | null;
  source: "database" | "env" | "mixed" | "none";
  configured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "ok" | "failed" | null;
  lastTestError: string | null;
  updatedAt: string | null;
};

export type UpdateMailConnectionPayload = {
  sendgridEnabled?: boolean;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpIgnoreTls?: boolean;
  smtpRequireTls?: boolean;
  defaultEmail?: string;
  defaultName?: string;
};

export type TestMailConnectionPayload = UpdateMailConnectionPayload & {
  testEmail: string;
};

export type MailTestResult = {
  success: boolean;
  provider: "sendgrid" | "smtp";
  message: string;
  testedAt: string;
};

export type KekaConnectionView = {
  companySubdomain: string | null;
  sandbox: boolean;
  authUrl: string | null;
  apiBaseUrl: string | null;
  clientIdMasked: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasApiKey: boolean;
  source: "database" | "env" | "mixed";
  configured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "ok" | "failed" | null;
  lastTestError: string | null;
  updatedAt: string | null;
  effectiveAuthUrl: string;
  effectiveApiBaseUrl: string;
};

export type UpdateKekaConnectionPayload = {
  companySubdomain?: string;
  sandbox?: boolean;
  authUrl?: string | null;
  apiBaseUrl?: string | null;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
};

export type KekaTestResult = {
  success: boolean;
  message: string;
  testedAt: string;
};

export type SetupSuperAdminSummary = {
  email: string;
  displayName: string;
};

export type SetupConfig = {
  entra: EntraConnectionView;
  mail: MailConnectionView;
  keka: KekaConnectionView;
  superAdmin: SetupSuperAdminSummary | null;
};
