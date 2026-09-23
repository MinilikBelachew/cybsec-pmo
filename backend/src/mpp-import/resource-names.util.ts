/** MSP Resource Names cells are comma-separated "Name" or "Name (Org)" values. */

const RESOURCE_NAMES_MAX = 1000;

export function splitResourceNames(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function joinResourceNames(names: string[]): string | null {
  const joined = names.map((name) => name.trim()).filter(Boolean).join(', ');
  if (!joined) return null;
  return joined.length <= RESOURCE_NAMES_MAX
    ? joined
    : joined.slice(0, RESOURCE_NAMES_MAX);
}

/** "Vinayak Sonkavada (CyberKnight)" → "Vinayak Sonkavada" */
export function bareResourceName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
}

/** Names from the stored MPP cell that are not already Owner / Backup. */
export function extraResourceNames(
  stored?: string | null,
  assignedDisplayNames: Array<string | null | undefined> = [],
): string[] {
  const seen = new Set(
    assignedDisplayNames
      .map((name) => bareResourceName(String(name || '')).toLowerCase())
      .filter(Boolean),
  );
  return splitResourceNames(stored).filter(
    (name) => !seen.has(bareResourceName(name).toLowerCase()),
  );
}

/** Owner / Backup first, then unmatched names stored from MPP import. */
export function mergeExportResourceNames(
  ownerFormatted: string,
  backupFormatted: string,
  stored?: string | null,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string | null) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = bareResourceName(text).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(text);
  };
  add(ownerFormatted);
  add(backupFormatted);
  for (const name of extraResourceNames(stored, [ownerFormatted, backupFormatted])) {
    add(name);
  }
  return parts.join(', ');
}
