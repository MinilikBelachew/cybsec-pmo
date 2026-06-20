import { devLogger } from "./dev-logger";
import { prodLogger } from "./prod-logger";

export type Logger = typeof devLogger;

export const logger: Logger =
  process.env.NODE_ENV === "production" ? prodLogger : devLogger;

export { devLogger, prodLogger };
