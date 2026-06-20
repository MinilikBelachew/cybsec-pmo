export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
};
