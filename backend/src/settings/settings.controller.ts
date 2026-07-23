import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { AuditArchiveService } from '../audit/archive/audit-archive.service';
import {
  AppSettingsService,
  mapAllocationPoliciesSettingsDto,
  mapAuditSettingsDto,
  mapSessionSecuritySettingsDto,
} from './app-settings.service';
import { AllocationPolicyService } from './allocation-policy.service';
import { SessionSecurityPolicyService } from './session-security-policy.service';
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

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
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
}
