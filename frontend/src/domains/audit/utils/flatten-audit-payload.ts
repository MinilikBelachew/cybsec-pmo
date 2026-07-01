import type { AuditJsonValue } from "../api/audit.api";

export type AuditPayloadTableRow = {
  field: string;
  value: string;
};

function formatPayloadCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length === 0 ? "[]" : JSON.stringify(value);
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "—";

    return JSON.stringify(value);
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function flattenAuditPayload(
  value: AuditJsonValue,
  prefix = "",
): AuditPayloadTableRow[] {
  if (value === null || value === undefined) {
    return prefix ? [{ field: prefix, value: "—" }] : [];
  }

  if (typeof value !== "object") {
    return [{ field: prefix || "value", value: formatPayloadCellValue(value) }];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [{ field: prefix || "value", value: "[]" }];
    }

    return value.flatMap((item, index) => {
      const field = prefix ? `${prefix}[${index}]` : `[${index}]`;
      if (item !== null && typeof item === "object") {
        return flattenAuditPayload(item as AuditJsonValue, field);
      }
      return [{ field, value: formatPayloadCellValue(item) }];
    });
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return [{ field: prefix || "value", value: "—" }];
  }

  return entries.flatMap(([key, nestedValue]) => {
    const field = prefix ? `${prefix}.${key}` : key;

    if (
      nestedValue !== null &&
      typeof nestedValue === "object" &&
      !Array.isArray(nestedValue)
    ) {
      const nestedEntries = Object.entries(nestedValue as Record<string, unknown>);
      if (nestedEntries.length === 0) {
        return [{ field, value: "—" }];
      }

      const isSimpleObject = nestedEntries.every(
        ([, item]) => item === null || typeof item !== "object",
      );

      if (isSimpleObject && nestedEntries.length <= 4) {
        return flattenAuditPayload(nestedValue as AuditJsonValue, field);
      }

      return [{ field, value: formatPayloadCellValue(nestedValue) }];
    }

    if (Array.isArray(nestedValue)) {
      if (nestedValue.length === 0) {
        return [{ field, value: "[]" }];
      }

      const primitivesOnly = nestedValue.every(
        (item) => item === null || typeof item !== "object",
      );

      if (primitivesOnly) {
        return [{ field, value: nestedValue.map((item) => formatPayloadCellValue(item)).join(", ") }];
      }

      return flattenAuditPayload(nestedValue as AuditJsonValue, field);
    }

    return [{ field, value: formatPayloadCellValue(nestedValue) }];
  });
}
