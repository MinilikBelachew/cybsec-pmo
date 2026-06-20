export const devLogger = {
  info: (message: string, meta?: unknown) => {
    console.log(`%c[INFO] ${message}`, "color: #3b82f6", meta ?? "");
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(`%c[WARN] ${message}`, "color: #f59e0b", meta ?? "");
  },
  error: (message: string, meta?: unknown) => {
    console.error(`%c[ERROR] ${message}`, "color: #ef4444", meta ?? "");
  },
  audit: (message: string, meta?: unknown) => {
    console.log(`%c[AUDIT] ${message}`, "color: #8b5cf6; font-weight:bold", meta ?? "");
  },
};
