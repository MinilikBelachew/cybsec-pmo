export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  /** Global API throttle: max requests per IP within ttlMs (TC-M1.7-10). */
  rateLimitPerIp: number;
  rateLimitTtlMs: number;
};
