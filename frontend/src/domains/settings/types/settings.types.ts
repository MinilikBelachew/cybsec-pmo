export type AuditSettings = {
  auditRetentionMonths: number;
  auditExportMaxRows: number;
  auditExportExcelJsonCellLimit: number;
  auditExportPdfJsonLimit: number;
  auditArchiveEnabled: boolean;
  lastAuditArchiveAt: string | null;
  lastAuditArchiveCount: number;
  updatedAt: string;
};

export type UpdateAuditSettingsPayload = {
  auditRetentionMonths?: number;
  auditExportMaxRows?: number;
  auditExportExcelJsonCellLimit?: number;
  auditExportPdfJsonLimit?: number;
  auditArchiveEnabled?: boolean;
};
