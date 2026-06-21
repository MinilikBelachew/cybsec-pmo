export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6002/api/v1",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:6001",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
  entraClientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? "",
  entraTenantId: process.env.NEXT_PUBLIC_ENTRA_TENANT_ID ?? "",
};

