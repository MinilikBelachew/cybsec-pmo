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
  mapAuditSettingsDto,
} from './app-settings.service';
import {
  AuditSettingsDto,
  UpdateAuditSettingsDto,
} from './dto/audit-settings.dto';

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
}
