import { getApiErrorMessage } from "@/core/errors/api-error";

/** Matches backend file.config maxFileSize. */
export const ATTACHMENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Max attachments allowed on a single task (also max per selection). */
export const ATTACHMENT_MAX_FILES_PER_TASK = 20;

/** @deprecated Use ATTACHMENT_MAX_FILES_PER_TASK */
export const ATTACHMENT_MAX_FILES_PER_SELECTION = ATTACHMENT_MAX_FILES_PER_TASK;

export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "mpp",
  "mpx",
  "xml",
] as const;

export const ATTACHMENT_ACCEPT =
  ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.mpp,.mpx,.xml";

export const ATTACHMENT_ALLOWED_TYPES_LABEL =
  "JPG, JPEG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, MPP, MPX, XML";

const MAX_SIZE_MB = ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024);

export const ATTACHMENT_LIMITS_HINT = `Up to ${ATTACHMENT_MAX_FILES_PER_TASK} files per task · ${MAX_SIZE_MB} MB each · ${ATTACHMENT_ALLOWED_TYPES_LABEL}`;

function extensionOf(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase();
}

export function isAllowedAttachmentFilename(filename: string): boolean {
  const ext = extensionOf(filename);
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export type AttachmentValidationIssue = {
  fileName: string;
  reason: "type" | "size" | "count";
  message: string;
};

export type AttachmentValidationResult = {
  valid: File[];
  issues: AttachmentValidationIssue[];
};

/**
 * Client-side checks aligned with backend upload limits.
 * Invalid files are excluded; callers should surface `issues` and only upload `valid`.
 * Pass `existingCount` so the per-task cap of 20 is enforced across add sessions.
 */
export function validateAttachmentFiles(
  files: File[],
  options?: { maxFiles?: number; existingCount?: number },
): AttachmentValidationResult {
  const maxFiles = options?.maxFiles ?? ATTACHMENT_MAX_FILES_PER_TASK;
  const existingCount = options?.existingCount ?? 0;
  const issues: AttachmentValidationIssue[] = [];
  const valid: File[] = [];

  const remainingSlots = Math.max(0, maxFiles - existingCount);
  if (files.length > remainingSlots) {
    issues.push({
      fileName: "",
      reason: "count",
      message:
        remainingSlots === 0
          ? `This task already has the maximum of ${maxFiles} files.`
          : `You can add at most ${remainingSlots} more file${remainingSlots === 1 ? "" : "s"} (limit ${maxFiles} per task).`,
    });
  }

  const candidates = files.slice(0, remainingSlots);

  for (const file of candidates) {
    if (!isAllowedAttachmentFilename(file.name)) {
      issues.push({
        fileName: file.name,
        reason: "type",
        message: `"${file.name}" is not a supported file type. Allowed: ${ATTACHMENT_ALLOWED_TYPES_LABEL}.`,
      });
      continue;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      issues.push({
        fileName: file.name,
        reason: "size",
        message: `"${file.name}" is ${sizeMb} MB. Each file must be ${MAX_SIZE_MB} MB or smaller.`,
      });
      continue;
    }
    valid.push(file);
  }

  return { valid, issues };
}

/** First user-facing message for a validation batch (toast-friendly). */
export function attachmentValidationToastMessage(
  issues: AttachmentValidationIssue[],
): string {
  if (!issues.length) return "";
  if (issues.length === 1) return issues[0].message;
  const types = issues.filter((i) => i.reason === "type").length;
  const sizes = issues.filter((i) => i.reason === "size").length;
  const counts = issues.filter((i) => i.reason === "count").length;
  const parts: string[] = [];
  if (counts) parts.push(issues.find((i) => i.reason === "count")!.message);
  if (types) parts.push(`${types} unsupported file type${types === 1 ? "" : "s"}`);
  if (sizes) {
    parts.push(
      `${sizes} file${sizes === 1 ? "" : "s"} over the ${MAX_SIZE_MB} MB limit`,
    );
  }
  return parts.join(" · ");
}

const FILE_UPLOAD_ERROR_CODES: Record<string, string> = {
  cantUploadFileType: `Unsupported file type. Allowed: ${ATTACHMENT_ALLOWED_TYPES_LABEL}.`,
  LIMIT_FILE_SIZE: `Each file must be ${MAX_SIZE_MB} MB or smaller.`,
  LIMIT_FILE_COUNT: `A task can have at most ${ATTACHMENT_MAX_FILES_PER_TASK} files.`,
  attachmentLimitExceeded: `A task can have at most ${ATTACHMENT_MAX_FILES_PER_TASK} files.`,
  LIMIT_UNEXPECTED_FILE: "Unexpected file field. Please try uploading again.",
};

/** Returns a friendly message for known file-upload API codes, or null. */
export function mapFileUploadErrorCode(code: string | undefined | null): string | null {
  if (!code) return null;
  if (FILE_UPLOAD_ERROR_CODES[code]) return FILE_UPLOAD_ERROR_CODES[code];

  const lower = code.toLowerCase();
  if (
    lower.includes("file too large") ||
    lower.includes("limit_file_size") ||
    lower.includes("payload too large")
  ) {
    return FILE_UPLOAD_ERROR_CODES.LIMIT_FILE_SIZE;
  }
  if (
    lower.includes("limit_file_count") ||
    lower.includes("too many files") ||
    lower.includes("attachmentlimitexceeded")
  ) {
    return FILE_UPLOAD_ERROR_CODES.LIMIT_FILE_COUNT;
  }
  if (code === "cantUploadFileType" || lower.includes("cantuploadfiletype")) {
    return FILE_UPLOAD_ERROR_CODES.cantUploadFileType;
  }
  return null;
}

/**
 * Maps upload / multipart API errors to clear copy (avoids raw codes like cantUploadFileType).
 */
export function formatFileUploadError(
  error: unknown,
  fallback = "Failed to upload file",
): string {
  const payload =
    error && typeof error === "object" && "data" in error
      ? (error as { data?: { errors?: Record<string, string>; message?: string } }).data
      : undefined;

  const code =
    payload?.errors?.file ??
    payload?.errors?.attachment ??
    (payload?.errors ? Object.values(payload.errors)[0] : undefined) ??
    payload?.message;

  const mapped = mapFileUploadErrorCode(code) ?? mapFileUploadErrorCode(getApiErrorMessage(error, ""));
  if (mapped) return mapped;

  const msg = getApiErrorMessage(error, "");
  return msg || fallback;
}
