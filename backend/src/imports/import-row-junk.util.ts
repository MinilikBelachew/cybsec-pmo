/**
 * TC-M1.8-02 — Excel trailing / formatting rows must not become importable records.
 */

/** Normalize cell text (NBSP → space, trim). */
export function normalizeImportCell(raw: string | null | undefined): string {
  if (raw == null) return '';
  return String(raw).replace(/\u00a0/g, ' ').trim();
}

/**
 * True when Title/Name is empty or a common Excel junk placeholder
 * (dashes, 0, #N/A, etc.).
 */
export function hasMeaningfulImportTitle(
  raw: string | null | undefined,
): boolean {
  const title = normalizeImportCell(raw);
  if (!title) return false;
  if (/^[-–—._*=#\s]+$/.test(title)) return false;
  if (
    /^(0+|n\/?a|null|undefined|none|#n\/?a|#ref!|#value!|#name\?)$/i.test(
      title,
    )
  ) {
    return false;
  }
  return true;
}
