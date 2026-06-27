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

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: ApiErrorPayload }).data
    if (data?.message) return data.message
    const fieldError = data?.errors ? Object.values(data.errors)[0] : undefined
    if (fieldError) return fieldError
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}
