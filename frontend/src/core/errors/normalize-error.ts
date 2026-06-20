import { AppError } from "./app-error";
import { ApiError } from "./api-error";

export interface NormalizedError {
  message: string;
  code: string;
  statusCode: number;
}

/**
 * Converts any thrown value (ApiError, AppError, Error, string, unknown)
 * into a consistent, UI-friendly error shape.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.code ?? "API_ERROR",
      statusCode: error.status,
    };
  }

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
    };
  }

  return {
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
  };
}
