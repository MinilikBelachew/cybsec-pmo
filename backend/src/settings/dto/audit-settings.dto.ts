import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AUDIT_SETTINGS_LIMITS } from '../app-settings.constants';

export class AuditSettingsDto {
  @ApiProperty({ example: 12 })
  auditRetentionMonths: number;

  @ApiProperty({ example: 10000 })
  auditExportMaxRows: number;

  @ApiProperty({ example: 30000 })
  auditExportExcelJsonCellLimit: number;

  @ApiProperty({ example: 800 })
  auditExportPdfJsonLimit: number;

  @ApiProperty({ example: true })
  auditArchiveEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastAuditArchiveAt: string | null;

  @ApiProperty({ example: 0 })
  lastAuditArchiveCount: number;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateAuditSettingsDto {
  @ApiPropertyOptional({
    minimum: AUDIT_SETTINGS_LIMITS.retentionMonths.min,
    maximum: AUDIT_SETTINGS_LIMITS.retentionMonths.max,
  })
  @IsOptional()
  @IsInt()
  @Min(AUDIT_SETTINGS_LIMITS.retentionMonths.min)
  @Max(AUDIT_SETTINGS_LIMITS.retentionMonths.max)
  auditRetentionMonths?: number;

  @ApiPropertyOptional({
    minimum: AUDIT_SETTINGS_LIMITS.exportMaxRows.min,
    maximum: AUDIT_SETTINGS_LIMITS.exportMaxRows.max,
  })
  @IsOptional()
  @IsInt()
  @Min(AUDIT_SETTINGS_LIMITS.exportMaxRows.min)
  @Max(AUDIT_SETTINGS_LIMITS.exportMaxRows.max)
  auditExportMaxRows?: number;

  @ApiPropertyOptional({
    minimum: AUDIT_SETTINGS_LIMITS.excelJsonCellLimit.min,
    maximum: AUDIT_SETTINGS_LIMITS.excelJsonCellLimit.max,
  })
  @IsOptional()
  @IsInt()
  @Min(AUDIT_SETTINGS_LIMITS.excelJsonCellLimit.min)
  @Max(AUDIT_SETTINGS_LIMITS.excelJsonCellLimit.max)
  auditExportExcelJsonCellLimit?: number;

  @ApiPropertyOptional({
    minimum: AUDIT_SETTINGS_LIMITS.pdfJsonLimit.min,
    maximum: AUDIT_SETTINGS_LIMITS.pdfJsonLimit.max,
  })
  @IsOptional()
  @IsInt()
  @Min(AUDIT_SETTINGS_LIMITS.pdfJsonLimit.min)
  @Max(AUDIT_SETTINGS_LIMITS.pdfJsonLimit.max)
  auditExportPdfJsonLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auditArchiveEnabled?: boolean;
}
