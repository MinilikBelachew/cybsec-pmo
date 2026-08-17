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
  errors?: Record<string, unknown>
}

export type FieldErrorLeaf = {
  field: string
  message: string
}

/** Walk nested `{ allocations: { 0: { overrideReason: "..." } } }` into leaf messages. */
export function flattenFieldErrorMessages(errors: unknown): FieldErrorLeaf[] {
  const leaves: FieldErrorLeaf[] = []

  const walk = (value: unknown, path: string[]) => {
    if (typeof value === "string" && value.trim()) {
      leaves.push({
        field: path[path.length - 1] ?? "form",
        message: value.trim(),
      })
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...path, String(index)]))
      return
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        walk(child, [...path, key])
      }
    }
  }

  walk(errors, [])
  return leaves
}

function normalizeApiErrorPayload(data: unknown): ApiErrorPayload | null {
  if (!data || typeof data !== "object") return null

  const body = data as Record<string, unknown>

  if (typeof body.message === "string") {
    return {
      message: body.message,
      errors:
        body.errors && typeof body.errors === "object"
          ? (body.errors as Record<string, unknown>)
          : undefined,
    }
  }

  if (body.message && typeof body.message === "object") {
    const nested = body.message as Record<string, unknown>
    const nestedErrors =
      nested.errors && typeof nested.errors === "object"
        ? (nested.errors as Record<string, unknown>)
        : undefined
    const nestedMessage =
      typeof nested.message === "string" ? nested.message : undefined

    if (nestedMessage || nestedErrors) {
      return { message: nestedMessage, errors: nestedErrors }
    }
  }

  if (body.errors && typeof body.errors === "object") {
    return { errors: body.errors as Record<string, unknown> }
  }

  return null
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error && typeof error === "object" && "data" in error) {
    const payload = normalizeApiErrorPayload((error as { data?: unknown }).data)
    const fieldError = flattenFieldErrorMessages(payload?.errors)[0]?.message
    if (fieldError) return fieldError
    if (payload?.message) return payload.message
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}
