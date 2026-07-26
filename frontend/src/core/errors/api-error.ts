export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)

    this.status = status
    this.code = code
  }
}

type ApiErrorPayload = {
  message?: string
  errors?: Record<string, string>
}

function normalizeApiErrorPayload(data: unknown): ApiErrorPayload | null {
  if (!data || typeof data !== "object") return null

  const body = data as Record<string, unknown>

  if (typeof body.message === "string") {
    return {
      message: body.message,
      errors:
        body.errors && typeof body.errors === "object"
          ? (body.errors as Record<string, string>)
          : undefined,
    }
  }

  if (body.message && typeof body.message === "object") {
    const nested = body.message as Record<string, unknown>
    const nestedErrors =
      nested.errors && typeof nested.errors === "object"
        ? (nested.errors as Record<string, string>)
        : undefined
    const nestedMessage =
      typeof nested.message === "string" ? nested.message : undefined

    if (nestedMessage || nestedErrors) {
      return { message: nestedMessage, errors: nestedErrors }
    }
  }

  if (body.errors && typeof body.errors === "object") {
    return { errors: body.errors as Record<string, string> }
  }

  return null
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error && typeof error === "object" && "data" in error) {
    const payload = normalizeApiErrorPayload((error as { data?: unknown }).data)
    if (payload?.message) return payload.message
    const fieldError = payload?.errors ? Object.values(payload.errors)[0] : undefined
    if (fieldError) return fieldError
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}
