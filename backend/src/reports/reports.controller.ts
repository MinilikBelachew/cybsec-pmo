import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckAnyModulePermission } from '../casl/decorators/check-any-module-permission.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { QueryUtilisationDto } from './dto/query-utilisation.dto';
import { UtilisationReportResponseDto } from './dto/utilisation-response.dto';
import { UpdateHealthRuleItemDto } from './dto/health-rules.dto';
import { UtilisationService } from './utilisation.service';
import { HealthRulesService } from './health/health-rules.service';
import {
  DataQualityRules,
  DataQualityService,
} from './data-quality/data-quality.service';
import {
  GeneratedReportsService,
  StatusReportType,
} from './generated-reports.service';
import {
  ReportScheduleInput,
  ReportSchedulesService,
} from './report-schedules.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Reports')
@Controller({
  path: 'reports',
  version: '1',
})
export class ReportsController {
  constructor(
    private readonly utilisationService: UtilisationService,
    private readonly healthRules: HealthRulesService,
    private readonly dataQuality: DataQualityService,
    private readonly generatedReports: GeneratedReportsService,
    private readonly schedules: ReportSchedulesService,
  ) {}

  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  @Get('utilisation')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UtilisationReportResponseDto })
  getUtilisationReport(
    @Query() query: QueryUtilisationDto,
    @Request() request: RequestWithAbility,
  ): Promise<UtilisationReportResponseDto> {
    return this.utilisationService.getUtilisationReport(
      query,
      request.caslUser!,
    );
  }

  @Get('health-rules')
  @CheckAnyModulePermission(
    { module: 'settings', action: 'security' },
    { module: 'reports', action: 'manage' },
  )
  listHealthRules() {
    return this.healthRules.listRules();
  }

  @Put('health-rules')
  @CheckAnyModulePermission(
    { module: 'settings', action: 'security' },
    { module: 'reports', action: 'manage' },
  )
  updateHealthRules(
    @Body() body: UpdateHealthRuleItemDto[],
    @Request() request: RequestWithAbility,
  ) {
    return this.healthRules.updateRules(body, request.user!.id);
  }

  @Get('health/projects')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  listProjectHealth(@Request() request: RequestWithAbility) {
    return this.healthRules.evaluateScopedProjects(request.caslUser!);
  }

  @Get('health/projects/:id')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  getProjectHealth(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.healthRules.evaluateProject(id, request.caslUser!);
  }

  @Get('data-quality')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  listDataQuality(
    @Query('resolved') resolved?: string,
    @Query('projectId') projectId?: string,
    @Query('flagType') flagType?: string,
  ) {
    return this.dataQuality.listFlags({ resolved, projectId, flagType });
  }

  @Get('data-quality/rules')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  getDataQualityRules() {
    return this.dataQuality.getRules();
  }

  @Put('data-quality/rules')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  updateDataQualityRules(
    @Body() body: DataQualityRules,
    @Request() request: RequestWithAbility,
  ) {
    return this.dataQuality.updateRules(body, request.user!.id);
  }

  @Post('data-quality')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  createDataQualityScan(@Body('projectId') projectId?: string) {
    return projectId
      ? this.dataQuality.scanProject(projectId)
      : this.dataQuality.scanAll();
  }

  @Post('data-quality/scan')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  scanDataQuality(@Body('projectId') projectId?: string) {
    return projectId
      ? this.dataQuality.scanProject(projectId)
      : this.dataQuality.scanAll();
  }

  @Patch('data-quality/:id/resolve')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  resolveDataQuality(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.dataQuality.resolveFlag(id, request.user!.id);
  }

  @Post('status')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  generateStatus(
    @Body() body: { reportType: StatusReportType; projectId: string },
    @Request() request: RequestWithAbility,
  ) {
    return this.generatedReports.generate(
      body.reportType,
      body.projectId,
      request.user!.id,
    );
  }

  @Get('status')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  listStatus(
    @Query('projectId') projectId?: string,
    @Query('reportType') reportType?: string,
    @Query('status') status?: string,
  ) {
    return this.generatedReports.list({ projectId, reportType, status });
  }

  @Get('status/:id')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  getStatus(@Param('id') id: string) {
    return this.generatedReports.get(id);
  }

  @Post('status/:id/approve')
  @CheckAbility('approve', 'Report')
  @CheckModulePermission('reports', 'approve')
  approveStatus(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.generatedReports.approve(id, request.user!.id);
  }

  @Post('status/:id/distribute')
  @CheckAbility('approve', 'Report')
  @CheckModulePermission('reports', 'approve')
  distributeStatus(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.generatedReports.distribute(id, request.user!.id);
  }

  @Get('status/:id/export')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'export')
  async exportStatus(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'docx' | 'xlsx' | 'excel' | 'csv' = 'pdf',
    @Res() response: Response,
  ) {
    const isExcel = format === 'xlsx' || format === 'excel';
    const buffer =
      format === 'csv'
        ? await this.generatedReports.exportCsv(id)
        : isExcel
          ? await this.generatedReports.exportExcel(id)
          : format === 'docx'
            ? await this.generatedReports.exportDocx(id)
            : await this.generatedReports.exportPdf(id);
    const extension = isExcel ? 'xlsx' : format;
    response
      .type(
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : isExcel
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : format === 'docx'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/pdf',
      )
      .attachment(`status-report-${id}.${extension}`)
      .send(buffer);
  }

  @Get('schedules')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  listSchedules() {
    return this.schedules.list();
  }

  @Get('schedules/:id')
  @CheckAbility('read', 'Report')
  @CheckModulePermission('reports', 'view')
  getSchedule(@Param('id') id: string) {
    return this.schedules.get(id);
  }

  @Post('schedules')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  createSchedule(
    @Body() body: ReportScheduleInput,
    @Request() request: RequestWithAbility,
  ) {
    return this.schedules.create(body, request.user!.id);
  }

  @Patch('schedules/:id')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  updateSchedule(
    @Param('id') id: string,
    @Body() body: Partial<ReportScheduleInput>,
  ) {
    return this.schedules.update(id, body);
  }

  @Delete('schedules/:id')
  @CheckAbility('manage', 'Report')
  @CheckModulePermission('reports', 'manage')
  removeSchedule(@Param('id') id: string) {
    return this.schedules.remove(id);
  }
}
