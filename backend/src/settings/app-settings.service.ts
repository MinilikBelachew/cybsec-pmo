import { Injectable } from '@nestjs/common';
import { AppSetting, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  APP_SETTINGS_ID,
  DEFAULT_ALLOCATION_POLICIES,
  DEFAULT_AUDIT_SETTINGS,
} from './app-settings.constants';
import { UpdateAuditSettingsDto } from './dto/audit-settings.dto';
import { UpdateAllocationPoliciesDto } from './dto/allocation-policies.dto';
import { AllocationRuntimePolicies } from './allocation-policy.types';
import { AllocationPolicySummaryDto } from '../projects/dto/project-allocation.dto';
import {
  parseDepartmentStaffingRules,
  parseDesignationRules,
} from './utils/allocation-policy.util';

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

  async getAllocationPolicies(): Promise<AllocationRuntimePolicies> {
    const row = await this.ensureSettingsRow();
    return this.toAllocationPolicies(row);
  }

  async updateAllocationPolicies(
    dto: UpdateAllocationPoliciesDto,
    updatedById?: string,
  ): Promise<AllocationRuntimePolicies> {
    await this.ensureSettingsRow();

    const row = await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        ...(dto.thresholdMode !== undefined
          ? { allocationThresholdMode: dto.thresholdMode }
          : {}),
        ...(dto.designationMismatchMode !== undefined
          ? { designationMismatchMode: dto.designationMismatchMode }
          : {}),
        ...(dto.departmentStaffingMode !== undefined
          ? { departmentStaffingMode: dto.departmentStaffingMode }
          : {}),
        ...(dto.designationRules !== undefined
          ? {
              designationRules: dto.designationRules as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.departmentStaffingRules !== undefined
          ? {
              departmentStaffingRules:
                dto.departmentStaffingRules as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(updatedById ? { updatedById } : {}),
      },
    });

    return this.toAllocationPolicies(row);
  }

  private async ensureSettingsRow(): Promise<AppSetting> {
    return this.prisma.appSetting.upsert({
      where: { id: APP_SETTINGS_ID },
      update: {},
      create: {
        id: APP_SETTINGS_ID,
        ...DEFAULT_AUDIT_SETTINGS,
        allocationThresholdMode: DEFAULT_ALLOCATION_POLICIES.allocationThresholdMode,
        designationMismatchMode: DEFAULT_ALLOCATION_POLICIES.designationMismatchMode,
        departmentStaffingMode: DEFAULT_ALLOCATION_POLICIES.departmentStaffingMode,
        designationRules: [...DEFAULT_ALLOCATION_POLICIES.designationRules],
        departmentStaffingRules:
          DEFAULT_ALLOCATION_POLICIES.departmentStaffingRules as Prisma.InputJsonValue,
      },
    });
  }

  private toAllocationPolicies(row: AppSetting): AllocationRuntimePolicies {
    const thresholdMode = this.toThresholdMode(row.allocationThresholdMode);
    const designationMismatchMode = this.toPolicyMode(row.designationMismatchMode);
    const departmentStaffingMode = this.toPolicyMode(row.departmentStaffingMode);

    return {
      thresholdMode,
      designationMismatchMode,
      departmentStaffingMode,
      designationRules: parseDesignationRules(row.designationRules),
      departmentStaffingRules: parseDepartmentStaffingRules(
        row.departmentStaffingRules,
      ),
      updatedAt: row.updatedAt,
    };
  }

  private toPolicyMode(value: string): AllocationRuntimePolicies['designationMismatchMode'] {
    if (value === 'block' || value === 'warn' || value === 'off') {
      return value;
    }
    return 'warn';
  }

  private toThresholdMode(value: string): AllocationRuntimePolicies['thresholdMode'] {
    if (value === 'block' || value === 'approve') {
      return value;
    }
    return 'warn';
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

export function mapAllocationPoliciesDto(
  policies: AllocationRuntimePolicies,
): AllocationPolicySummaryDto {
  return {
    thresholdMode: policies.thresholdMode,
    designationMismatchMode: policies.designationMismatchMode,
    departmentStaffingMode: policies.departmentStaffingMode,
    designationRules: policies.designationRules,
    departmentStaffingRules: policies.departmentStaffingRules,
  };
}

export function mapAllocationPoliciesSettingsDto(
  policies: AllocationRuntimePolicies,
) {
  return {
    ...mapAllocationPoliciesDto(policies),
    updatedAt: policies.updatedAt.toISOString(),
  };
}
