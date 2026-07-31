import fs from 'node:fs';
import path from 'node:path';

/**
 * Approved CyberSec document format (Status Report + Minutes of Meeting).
 * Derived from the signed-off PMO template requirements workbook.
 */

export type ReportDocType = 'WSR' | 'MSR' | 'MoM';
export type RagValue = 'green' | 'amber' | 'red';
export type ReportAudience = 'internal' | 'client';

/**
 * Whitelabel branding profile. Projects delivered on behalf of a partner
 * override these so the same template renders under the partner's identity.
 */
export type BrandProfile = {
  companyName: string;
  documentOwner: string;
  /** Filesystem path (env fallback). Prefer logoData when both are set. */
  logoPath: string | null;
  /** Logo bytes loaded from a branding profile. Preferred over logoPath. */
  logoData: Buffer | null;
  logoMimeType: string | null;
  primaryColor: string;
  accentColor: string;
  mutedColor: string;
  lineColor: string;
};

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  companyName: 'CyberSec',
  documentOwner: 'CyberSec PMO',
  logoPath: null,
  logoData: null,
  logoMimeType: null,
  primaryColor: '#0B3D5C',
  accentColor: '#C45C26',
  mutedColor: '#5A6A75',
  lineColor: '#D7DEE5',
};

/**
 * Merge defaults ← env ← explicit overrides. Callers that load a branding
 * profile from the database pass it as overrides so the same template
 * renders under that brand without any template change.
 */
export function resolveBrandProfile(
  overrides: Partial<BrandProfile> = {},
): BrandProfile {
  const fromEnv: Partial<BrandProfile> = {
    companyName: process.env.REPORT_BRAND_COMPANY_NAME || undefined,
    documentOwner: process.env.REPORT_BRAND_DOCUMENT_OWNER || undefined,
    logoPath: process.env.REPORT_BRAND_LOGO_PATH || undefined,
    primaryColor: process.env.REPORT_BRAND_PRIMARY_COLOR || undefined,
    accentColor: process.env.REPORT_BRAND_ACCENT_COLOR || undefined,
  };
  const merged = { ...DEFAULT_BRAND_PROFILE };
  for (const [key, value] of Object.entries({ ...fromEnv, ...overrides })) {
    if (value != null && value !== '') {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/** Approved status colours. Held here rather than inline so settings can override. */
export const RAG_COLORS: Record<RagValue, string> = {
  red: '#C00000',
  amber: '#FFC000',
  green: '#00B050',
};

/** Arial throughout: body 10, section heading 12, title 16. */
export const TYPOGRAPHY = {
  title: 16,
  sectionHeading: 12,
  body: 10,
  tableBody: 9,
  footer: 8,
} as const;

export const MEETING_TYPES = [
  'Kickoff',
  'Weekly Status Review',
  'Monthly Status Review',
  'Tech Support',
  'Implementation Session',
  'Steering',
  'Closure',
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];

export const INTERNAL_WATERMARK = 'Internal Use Only';

/** Printed wherever a mandatory field has no recorded value. */
export const NOT_RECORDED = 'Not recorded';

export const MOM_ACKNOWLEDGEMENT_NOTE =
  'Please review these minutes and reply to this email with any correction within two working days; otherwise they stand as recorded.';

export function docTypeLabel(docType: ReportDocType): string {
  if (docType === 'WSR') return 'Weekly Status Report';
  if (docType === 'MSR') return 'Monthly Status Report';
  return 'Minutes of Meeting';
}

/**
 * Colour-blind and greyscale safe: callers print this word beside the swatch
 * so the status never depends on colour alone.
 */
export function ragWord(value: string | null | undefined): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'green') return 'Green';
  if (normalized === 'amber') return 'Amber';
  if (normalized === 'red') return 'Red';
  return NOT_RECORDED;
}

export function ragColor(value: string | null | undefined): string {
  const normalized = String(value ?? '').toLowerCase() as RagValue;
  return RAG_COLORS[normalized] ?? DEFAULT_BRAND_PROFILE.mutedColor;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar dates are always spelled out, e.g. "July 27, 2026". */
export function formatApprovedDate(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return NOT_RECORDED;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatApprovedDateTime(
  value: string | Date | null | undefined,
  timeZone?: string | null,
): string {
  const date = toDate(value);
  if (!date) return NOT_RECORDED;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatApprovedDate(date)} at ${hours}:${minutes}${timeZone ? ` ${timeZone}` : ' UTC'}`;
}

export function formatApprovedTime(
  value: string | Date | null | undefined,
  timeZone?: string | null,
): string {
  const date = toDate(value);
  if (!date) return NOT_RECORDED;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${timeZone ?? 'UTC'}`;
}

/** Year-first so exported files sort chronologically in a folder listing. */
export function formatFileNameDate(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value) ?? new Date();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}${month}${day}`;
}

function fileNameToken(value: string | null | undefined, fallback: string) {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

/**
 * Approved convention:
 * ProjectRef_CustomerName_ProjectName_DocType_Date_vN
 * e.g. PRJ0142_ADNOC_FortraDLPRollout_WSR_20260727_v1
 */
export function buildExportFileName(input: {
  projectRef?: string | null;
  customerName?: string | null;
  projectName?: string | null;
  docType: ReportDocType;
  date?: string | Date | null;
  version?: number | null;
  extension: string;
}): string {
  const parts = [
    fileNameToken(input.projectRef, 'PRJ'),
    fileNameToken(input.customerName, 'Customer'),
    fileNameToken(input.projectName, 'Project'),
    input.docType,
    formatFileNameDate(input.date),
    `v${input.version ?? 1}`,
  ];
  return `${parts.join('_')}.${input.extension.replace(/^\./, '')}`;
}

/** Footer reference, also used as the document control block's first value. */
export function buildDocumentReference(input: {
  projectRef?: string | null;
  docType: ReportDocType;
  date?: string | Date | null;
  version?: number | null;
}): string {
  return [
    fileNameToken(input.projectRef, 'PRJ'),
    input.docType,
    formatFileNameDate(input.date),
    `v${input.version ?? 1}`,
  ].join('-');
}

/**
 * Derives a stable, readable project reference when no external PSA code is set.
 * Keeps the document reference and file name populated on every project.
 */
export function deriveProjectRef(input: {
  externalCode?: string | null;
  projectId: string;
}): string {
  if (input.externalCode?.trim()) {
    return input.externalCode.trim().toUpperCase();
  }
  const compact = input.projectId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `PRJ${compact.slice(0, 6)}`;
}

/** "Sara El Moursy, PMO Manager" — full name and role, per the approved block. */
export function formatSignatory(
  displayName?: string | null,
  roleName?: string | null,
): string | null {
  if (!displayName?.trim()) return null;
  const name = displayName.trim();
  return roleName?.trim() ? `${name}, ${roleName.trim()}` : name;
}

/**
 * pdfkit ships Helvetica, which is metrically compatible with Arial. Provide
 * REPORT_FONT_DIR containing Arial.ttf/Arial-Bold.ttf to embed Arial itself so
 * the PDF matches the DOCX glyph for glyph.
 */
export type PdfFontPair = {
  regular: string;
  bold: string;
  embedded: boolean;
};

let cachedFontPair: PdfFontPair | null = null;

export function resolvePdfFonts(): PdfFontPair {
  if (cachedFontPair) return cachedFontPair;
  const dir = process.env.REPORT_FONT_DIR;
  if (dir) {
    const regular = path.resolve(dir, 'Arial.ttf');
    const bold = path.resolve(dir, 'Arial-Bold.ttf');
    if (fs.existsSync(regular) && fs.existsSync(bold)) {
      cachedFontPair = { regular, bold, embedded: true };
      return cachedFontPair;
    }
  }
  cachedFontPair = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    embedded: false,
  };
  return cachedFontPair;
}

export const DOCX_FONT_FAMILY = 'Arial';
