export const APP_SETTINGS_ID = 'default';

export const DEFAULT_AUDIT_SETTINGS = {
  auditRetentionMonths: 12,
  auditExportMaxRows: 10_000,
  auditExportExcelJsonCellLimit: 30_000,
  auditExportPdfJsonLimit: 800,
  auditArchiveEnabled: true,
} as const;

export const AUDIT_SETTINGS_LIMITS = {
  retentionMonths: { min: 1, max: 120 },
  exportMaxRows: { min: 100, max: 50_000 },
  excelJsonCellLimit: { min: 1_000, max: 32_767 },
  pdfJsonLimit: { min: 100, max: 10_000 },
} as const;

export const AUDIT_ARCHIVE_BATCH_SIZE = 500;
