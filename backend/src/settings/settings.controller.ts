import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { AuditArchiveService } from '../audit/archive/audit-archive.service';
import {
  AppSettingsService,
  mapAllocationPoliciesSettingsDto,
  mapAuditSettingsDto,
  mapSessionSecuritySettingsDto,
  mapTimesheetEscalationSettingsDto,
} from './app-settings.service';
import { AllocationPolicyService } from './allocation-policy.service';
import { SessionSecurityPolicyService } from './session-security-policy.service';
import { TimesheetEscalationPolicyService } from './timesheet-escalation-policy.service';
import { CostFormulaService } from './cost-formula.service';
import {
  AuditSettingsDto,
  UpdateAuditSettingsDto,
} from './dto/audit-settings.dto';
import {
  AllocationPoliciesDto,
  UpdateAllocationPoliciesDto,
} from './dto/allocation-policies.dto';
import {
  SessionSecuritySettingsDto,
  UpdateSessionSecuritySettingsDto,
} from './dto/session-security.dto';
import {
  TimesheetEscalationSettingsDto,
  UpdateTimesheetEscalationSettingsDto,
} from './dto/timesheet-escalation.dto';
import {
  CostFormulaSettingsDto,
  UpdateCostFormulaSettingsDto,
  mapCostFormulaSettingsDto,
} from './dto/cost-formula.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Settings')
@Controller({
  path: 'settings',
  version: '1',
})
export class SettingsController {
  constructor(
    private readonly appSettingsService: AppSettingsService,
    private readonly allocationPolicyService: AllocationPolicyService,
    private readonly sessionSecurityPolicyService: SessionSecurityPolicyService,
    private readonly timesheetEscalationPolicyService: TimesheetEscalationPolicyService,
    private readonly costFormulaService: CostFormulaService,
    private readonly auditArchiveService: AuditArchiveService,
  ) {}

  @CheckAbility('manage', 'Settings')
  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuditSettingsDto })
  async getAuditSettings() {
    const settings = await this.appSettingsService.getAuditSettings();
    return mapAuditSettingsDto(settings);
  }

  @CheckAbility('manage', 'Settings')
  @Patch('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuditSettingsDto })
  async updateAuditSettings(
    @Body() dto: UpdateAuditSettingsDto,
    @Request() request: RequestWithAbility,
  ) {
    const settings = await this.appSettingsService.updateAuditSettings(
      dto,
      request.user?.id,
    );
    return mapAuditSettingsDto(settings);
  }

  @CheckAbility('manage', 'Settings')
  @Patch('audit/run-archive')
  @HttpCode(HttpStatus.OK)
  async runAuditArchive() {
    const archivedCount = await this.auditArchiveService.runScheduledArchive();
    const settings = await this.appSettingsService.getAuditSettings();
    return {
      archivedCount,
      settings: mapAuditSettingsDto(settings),
    };
  }

  @CheckAbility('manage', 'Settings')
  @Get('allocation-policies')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationPoliciesDto })
  async getAllocationPolicies() {
    const policies = await this.appSettingsService.getAllocationPolicies();
    return mapAllocationPoliciesSettingsDto(policies);
  }

  @CheckAbility('manage', 'Settings')
  @Patch('allocation-policies')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationPoliciesDto })
  async updateAllocationPolicies(
    @Body() dto: UpdateAllocationPoliciesDto,
    @Request() request: RequestWithAbility,
  ) {
    const policies = await this.appSettingsService.updateAllocationPolicies(
      dto,
      request.user?.id,
    );
    this.allocationPolicyService.invalidateCache();
    return mapAllocationPoliciesSettingsDto(policies);
  }

  @CheckAbility('manage', 'Settings')
  @Get('session-security')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessionSecuritySettingsDto })
  async getSessionSecuritySettings() {
    const settings = await this.appSettingsService.getSessionSecuritySettings();
    return mapSessionSecuritySettingsDto(settings);
  }

  @CheckAbility('manage', 'Settings')
  @Patch('session-security')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessionSecuritySettingsDto })
  async updateSessionSecuritySettings(
    @Body() dto: UpdateSessionSecuritySettingsDto,
    @Request() request: RequestWithAbility,
  ) {
    const settings = await this.appSettingsService.updateSessionSecuritySettings(
      dto,
      request.user?.id,
    );
    this.sessionSecurityPolicyService.invalidateCache();
    return mapSessionSecuritySettingsDto(settings);
  }

  @CheckAbility('manage', 'Settings')
  @Get('timesheet-escalation')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetEscalationSettingsDto })
  async getTimesheetEscalationSettings() {
    const settings =
      await this.appSettingsService.getTimesheetEscalationSettings();
    return mapTimesheetEscalationSettingsDto(settings);
  }

  @CheckAbility('manage', 'Settings')
  @Patch('timesheet-escalation')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetEscalationSettingsDto })
  async updateTimesheetEscalationSettings(
    @Body() dto: UpdateTimesheetEscalationSettingsDto,
    @Request() request: RequestWithAbility,
  ) {
    const settings =
      await this.appSettingsService.updateTimesheetEscalationSettings(
        dto,
        request.user?.id,
      );
    this.timesheetEscalationPolicyService.invalidateCache();
    return mapTimesheetEscalationSettingsDto(settings);
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('cost-formula')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CostFormulaSettingsDto })
  async getCostFormulaSettings() {
    const { formula, updatedAt } =
      await this.appSettingsService.getCostFormula();
    return mapCostFormulaSettingsDto(formula, updatedAt);
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Patch('cost-formula')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CostFormulaSettingsDto })
  async updateCostFormulaSettings(
    @Body() dto: UpdateCostFormulaSettingsDto,
    @Request() request: RequestWithAbility,
  ) {
    const { formula, updatedAt } =
      await this.appSettingsService.updateCostFormula(
        dto,
        request.user?.id,
        false,
      );
    this.costFormulaService.invalidateCache();
    return mapCostFormulaSettingsDto(formula, updatedAt);
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('cost-formula/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CostFormulaSettingsDto })
  async approveCostFormulaSettings(
    @Body() dto: UpdateCostFormulaSettingsDto,
    @Request() request: RequestWithAbility,
  ) {
    const { formula, updatedAt } =
      await this.appSettingsService.updateCostFormula(
        dto,
        request.user?.id,
        true,
      );
    this.costFormulaService.invalidateCache();
    return mapCostFormulaSettingsDto(formula, updatedAt);
  }
}
