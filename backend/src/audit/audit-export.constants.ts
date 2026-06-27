export const AUDIT_EXPORT_FORMATS = ['json', 'xlsx', 'pdf'] as const;

export type AuditExportFormat = (typeof AUDIT_EXPORT_FORMATS)[number];
