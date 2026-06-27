function deriveWsUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:6001";
  }
}

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? deriveWsUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1"),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
};

