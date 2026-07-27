/**
 * Interim CyberSec sample report branding.
 * Replace with approved Word/PDF assets when Cybsec provides final templates.
 */
export const CYBERSEC_SAMPLE_TEMPLATE = {
  brandName: 'CyberSec',
  productName: 'CyberSec PMO',
  confidentiality: 'CONFIDENTIAL — For authorised recipients only',
  templateVersion: 'sample-cybersec-v1',
  notice:
    'Interim sample template for Gate 3 UAT. Replace with approved CyberSec Word/PDF assets when available.',
  colors: {
    primary: '#0B3D5C',
    accent: '#C45C26',
    muted: '#5A6A75',
    line: '#D7DEE5',
    rag: {
      green: '#1B7F4E',
      amber: '#B7791F',
      red: '#B42318',
    },
  },
} as const;

export type StatusReportKind = 'WSR' | 'MSR' | 'MoM';

export function reportKindLabel(kind: StatusReportKind): string {
  if (kind === 'WSR') return 'Weekly Status Report';
  if (kind === 'MSR') return 'Monthly Status Report';
  return 'Minutes of Meeting';
}

export function formatRagLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'green') return 'GREEN';
  if (normalized === 'amber') return 'AMBER';
  if (normalized === 'red') return 'RED';
  return value.toUpperCase();
}
