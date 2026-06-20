export const prodLogger = {
  info: (message: string, meta?: unknown) => {
    if (typeof window === "undefined") {
      console.log(JSON.stringify({ level: "info", message, meta, ts: new Date().toISOString() }));
    }
  },
  warn: (message: string, meta?: unknown) => {
    if (typeof window === "undefined") {
      console.warn(JSON.stringify({ level: "warn", message, meta, ts: new Date().toISOString() }));
    }
  },
  error: (message: string, meta?: unknown) => {
    console.error(JSON.stringify({ level: "error", message, meta, ts: new Date().toISOString() }));
  },
  audit: (message: string, meta?: unknown) => {
    console.log(JSON.stringify({ level: "audit", message, meta, ts: new Date().toISOString() }));
  },
};
