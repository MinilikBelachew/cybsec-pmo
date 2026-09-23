import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AppSetting, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  APP_SETTINGS_ID,
  DEFAULT_ALLOCATION_POLICIES,
  DEFAULT_AUDIT_SETTINGS,
  DEFAULT_SESSION_SECURITY,
  DEFAULT_TIMESHEET_ESCALATION,
  SESSION_SECURITY_LIMITS,
  TIMESHEET_ESCALATION_LIMITS,
} from './app-settings.constants';
import {
  CostFormulaConfig,
  COST_FORMULA_LIMITS,
  DEFAULT_COST_FORMULA,
} from './cost-formula.constants';
import { UpdateCostFormulaSettingsDto } from './dto/cost-formula.dto';
import { UpdateAuditSettingsDto } from './dto/audit-settings.dto';
import { UpdateAllocationPoliciesDto } from './dto/allocation-policies.dto';
import { UpdateSessionSecuritySettingsDto } from './dto/session-security.dto';
import { UpdateTimesheetEscalationSettingsDto } from './dto/timesheet-escalation.dto';
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

export type SessionSecurityRuntimeSettings = {
  idleTimeoutSec: number;
  warningBeforeSec: number;
  updatedAt: Date;
};

export type TimesheetEscalationRuntimeSettings = {
  escalationDays: number;
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

  async getSessionSecuritySettings(): Promise<SessionSecurityRuntimeSettings> {
    const row = await this.ensureSettingsRow();
    return this.toSessionSecuritySettings(row);
  }

  async updateSessionSecuritySettings(
    dto: UpdateSessionSecuritySettingsDto,
    updatedById?: string,
  ): Promise<SessionSecurityRuntimeSettings> {
    const existing = await this.ensureSettingsRow();
    const idleTimeoutSec =
      dto.idleTimeoutSec ?? existing.sessionIdleTimeoutSec;
    const warningBeforeSec =
      dto.warningBeforeSec ?? existing.sessionWarningBeforeSec;

    if (warningBeforeSec >= idleTimeoutSec) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: {
          warningBeforeSec: 'warningBeforeSecMustBeLessThanIdleTimeoutSec',
        },
      });
    }

    if (
      warningBeforeSec < SESSION_SECURITY_LIMITS.warningBeforeSec.min ||
      idleTimeoutSec > SESSION_SECURITY_LIMITS.idleTimeoutSec.max ||
      idleTimeoutSec < SESSION_SECURITY_LIMITS.idleTimeoutSec.min ||
      warningBeforeSec > SESSION_SECURITY_LIMITS.warningBeforeSec.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { sessionSecurity: 'sessionSecurityOutOfRange' },
      });
    }

    const row = await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        sessionIdleTimeoutSec: idleTimeoutSec,
        sessionWarningBeforeSec: warningBeforeSec,
        ...(updatedById ? { updatedById } : {}),
      },
    });

    return this.toSessionSecuritySettings(row);
  }

  async getTimesheetEscalationSettings(): Promise<TimesheetEscalationRuntimeSettings> {
    const row = await this.ensureSettingsRow();
    return this.toTimesheetEscalationSettings(row);
  }

  async updateTimesheetEscalationSettings(
    dto: UpdateTimesheetEscalationSettingsDto,
    updatedById?: string,
  ): Promise<TimesheetEscalationRuntimeSettings> {
    const existing = await this.ensureSettingsRow();
    const escalationDays =
      dto.escalationDays ?? existing.timesheetEscalationDays;

    if (
      escalationDays < TIMESHEET_ESCALATION_LIMITS.escalationDays.min ||
      escalationDays > TIMESHEET_ESCALATION_LIMITS.escalationDays.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { escalationDays: 'escalationDaysOutOfRange' },
      });
    }

    const row = await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        timesheetEscalationDays: escalationDays,
        ...(updatedById ? { updatedById } : {}),
      },
    });

    return this.toTimesheetEscalationSettings(row);
  }

  async getCostFormula(): Promise<{
    formula: CostFormulaConfig;
    updatedAt: Date;
  }> {
    const row = await this.ensureSettingsRow();
    return {
      formula: this.parseCostFormula(row.costFormula),
      updatedAt: row.updatedAt,
    };
  }

  async updateCostFormula(
    dto: UpdateCostFormulaSettingsDto,
    updatedById?: string,
    approve = false,
  ): Promise<{ formula: CostFormulaConfig; updatedAt: Date }> {
    const existing = await this.ensureSettingsRow();
    const current = this.parseCostFormula(existing.costFormula);
    const next: CostFormulaConfig = {
      ...current,
      ...(dto.basis != null ? { basis: dto.basis } : {}),
      ...(dto.hoursPerWeek != null ? { hoursPerWeek: dto.hoursPerWeek } : {}),
      ...(dto.weeksPerYear != null ? { weeksPerYear: dto.weeksPerYear } : {}),
      ...(dto.otMultiplier != null ? { otMultiplier: dto.otMultiplier } : {}),
      ...(dto.leaveMode != null ? { leaveMode: dto.leaveMode } : {}),
      ...(dto.monthlyRemunerationType != null
        ? { monthlyRemunerationType: dto.monthlyRemunerationType }
        : {}),
    };

    if (
      next.hoursPerWeek < COST_FORMULA_LIMITS.hoursPerWeek.min ||
      next.hoursPerWeek > COST_FORMULA_LIMITS.hoursPerWeek.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { hoursPerWeek: 'hoursPerWeekOutOfRange' },
      });
    }
    if (
      next.weeksPerYear < COST_FORMULA_LIMITS.weeksPerYear.min ||
      next.weeksPerYear > COST_FORMULA_LIMITS.weeksPerYear.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { weeksPerYear: 'weeksPerYearOutOfRange' },
      });
    }
    if (
      next.otMultiplier < COST_FORMULA_LIMITS.otMultiplier.min ||
      next.otMultiplier > COST_FORMULA_LIMITS.otMultiplier.max
    ) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { otMultiplier: 'otMultiplierOutOfRange' },
      });
    }
    if (next.basis !== 'ctc' && next.basis !== 'gross') {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { basis: 'invalidBasis' },
      });
    }

    if (approve && updatedById) {
      next.version = current.version + 1;
      next.approvedBy = updatedById;
      next.approvedAt = new Date().toISOString();
    }

    const row = await this.prisma.appSetting.update({
      where: { id: APP_SETTINGS_ID },
      data: {
        costFormula: next as unknown as Prisma.InputJsonValue,
        ...(updatedById ? { updatedById } : {}),
      },
    });

    return {
      formula: this.parseCostFormula(row.costFormula),
      updatedAt: row.updatedAt,
    };
  }

  private parseCostFormula(raw: Prisma.JsonValue): CostFormulaConfig {
    const obj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return {
      basis: obj.basis === 'gross' ? 'gross' : DEFAULT_COST_FORMULA.basis,
      hoursPerWeek:
        typeof obj.hoursPerWeek === 'number'
          ? obj.hoursPerWeek
          : DEFAULT_COST_FORMULA.hoursPerWeek,
      weeksPerYear:
        typeof obj.weeksPerYear === 'number'
          ? obj.weeksPerYear
          : DEFAULT_COST_FORMULA.weeksPerYear,
      otMultiplier:
        typeof obj.otMultiplier === 'number'
          ? obj.otMultiplier
          : DEFAULT_COST_FORMULA.otMultiplier,
      leaveMode:
        obj.leaveMode === 'exclude_unpaid' || obj.leaveMode === 'prorate'
          ? obj.leaveMode
          : DEFAULT_COST_FORMULA.leaveMode,
      monthlyRemunerationType:
        typeof obj.monthlyRemunerationType === 'number'
          ? obj.monthlyRemunerationType
          : DEFAULT_COST_FORMULA.monthlyRemunerationType,
      version:
        typeof obj.version === 'number'
          ? obj.version
          : DEFAULT_COST_FORMULA.version,
      approvedBy:
        typeof obj.approvedBy === 'string' ? obj.approvedBy : null,
      approvedAt:
        typeof obj.approvedAt === 'string' ? obj.approvedAt : null,
    };
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
        sessionIdleTimeoutSec: DEFAULT_SESSION_SECURITY.sessionIdleTimeoutSec,
        sessionWarningBeforeSec: DEFAULT_SESSION_SECURITY.sessionWarningBeforeSec,
        timesheetEscalationDays:
          DEFAULT_TIMESHEET_ESCALATION.timesheetEscalationDays,
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

  private toSessionSecuritySettings(
    row: AppSetting,
  ): SessionSecurityRuntimeSettings {
    return {
      idleTimeoutSec: row.sessionIdleTimeoutSec,
      warningBeforeSec: row.sessionWarningBeforeSec,
      updatedAt: row.updatedAt,
    };
  }

  private toTimesheetEscalationSettings(
    row: AppSetting,
  ): TimesheetEscalationRuntimeSettings {
    return {
      escalationDays: row.timesheetEscalationDays,
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

export function mapSessionSecuritySettingsDto(
  settings: SessionSecurityRuntimeSettings,
) {
  return {
    idleTimeoutSec: settings.idleTimeoutSec,
    warningBeforeSec: settings.warningBeforeSec,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export function mapTimesheetEscalationSettingsDto(
  settings: TimesheetEscalationRuntimeSettings,
) {
  return {
    escalationDays: settings.escalationDays,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
