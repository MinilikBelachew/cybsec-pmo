import { Injectable } from '@nestjs/common';
import { AppSetting, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  APP_SETTINGS_ID,
  DEFAULT_AUDIT_SETTINGS,
} from './app-settings.constants';
import { UpdateAuditSettingsDto } from './dto/audit-settings.dto';

export type AuditRuntimeSettings = {
  auditRetentionMonths: number;
  auditExportMaxRows: number;
  auditExportExcelJsonCellLimit: number;
  auditExportPdfJsonLimit: number;
  auditArchiveEnabled: boolean;
  lastAuditArchiveAt: Date | null;
  lastAuditArchiveCount: number;
  updatedAt: Date;
};

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditSettings(): Promise<AuditRuntimeSettings> {
    const row = await this.ensureSettingsRow();
    return this.toAuditSettings(row);
  }

  async updateAuditSettings(
    dto: UpdateAuditSettingsDto,
    updatedById?: string,
  ): Promise<AuditRuntimeSettings> {
    await this.ensureSettingsRow();

    const row = await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        ...(dto.auditRetentionMonths !== undefined
          ? { auditRetentionMonths: dto.auditRetentionMonths }
          : {}),
        ...(dto.auditExportMaxRows !== undefined
          ? { auditExportMaxRows: dto.auditExportMaxRows }
          : {}),
        ...(dto.auditExportExcelJsonCellLimit !== undefined
          ? {
              auditExportExcelJsonCellLimit: dto.auditExportExcelJsonCellLimit,
            }
          : {}),
        ...(dto.auditExportPdfJsonLimit !== undefined
          ? { auditExportPdfJsonLimit: dto.auditExportPdfJsonLimit }
          : {}),
        ...(dto.auditArchiveEnabled !== undefined
          ? { auditArchiveEnabled: dto.auditArchiveEnabled }
          : {}),
        ...(updatedById ? { updatedById } : {}),
      },
    });

    return this.toAuditSettings(row);
  }

  async recordArchiveRun(archivedCount: number): Promise<void> {
    await this.ensureSettingsRow();
    await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        lastAuditArchiveAt: new Date(),
        lastAuditArchiveCount: archivedCount,
      },
    });
  }

  private async ensureSettingsRow(): Promise<AppSetting> {
    return this.prisma.appSetting.upsert({
      where: { id: APP_SETTINGS_ID },
      update: {},
      create: {
        id: APP_SETTINGS_ID,
        ...DEFAULT_AUDIT_SETTINGS,
      },
    });
  }

  private toAuditSettings(row: AppSetting): AuditRuntimeSettings {
    return {
      auditRetentionMonths: row.auditRetentionMonths,
      auditExportMaxRows: row.auditExportMaxRows,
      auditExportExcelJsonCellLimit: row.auditExportExcelJsonCellLimit,
      auditExportPdfJsonLimit: row.auditExportPdfJsonLimit,
      auditArchiveEnabled: row.auditArchiveEnabled,
      lastAuditArchiveAt: row.lastAuditArchiveAt,
      lastAuditArchiveCount: row.lastAuditArchiveCount,
      updatedAt: row.updatedAt,
    };
  }
}

export function mapAuditSettingsDto(
  settings: AuditRuntimeSettings,
): Prisma.JsonObject {
  return {
    auditRetentionMonths: settings.auditRetentionMonths,
    auditExportMaxRows: settings.auditExportMaxRows,
    auditExportExcelJsonCellLimit: settings.auditExportExcelJsonCellLimit,
    auditExportPdfJsonLimit: settings.auditExportPdfJsonLimit,
    auditArchiveEnabled: settings.auditArchiveEnabled,
    lastAuditArchiveAt: settings.lastAuditArchiveAt?.toISOString() ?? null,
    lastAuditArchiveCount: settings.lastAuditArchiveCount,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
