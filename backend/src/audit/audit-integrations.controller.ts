import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import {
  FailedSyncRecordListResponseDto,
  KekaSyncLogListResponseDto,
  KekaSyncStatusResponseDto,
  QueryFailedSyncRecordsDto,
  QueryKekaSyncLogsDto,
  QueryTimesheetReconcileDto,
  RetryKekaSyncDto,
  RetryKekaSyncResultDto,
  TimesheetReconcileResponseDto,
} from '../integrations/keka/dto/keka-integration.dto';
import {
  KekaConnectionResponseDto,
  KekaConnectionSecretsDto,
  KekaConnectionTestResultDto,
  UpdateKekaConnectionDto,
} from '../integrations/keka/dto/keka-connection.dto';
import { KekaIntegrationAdminService } from '../integrations/keka/keka-integration-admin.service';
import { KekaConnectionService } from '../integrations/keka/keka-connection.service';
import {
  KekaSyncEnqueueResultDto,
  KekaSyncJobStatusDto,
} from '../integrations/keka/dto/keka-sync.dto';
import { KekaSyncService } from '../integrations/keka/sync/keka-sync.service';

type RequestWithUser = {
  user?: { id: string };
};

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('AuditLogs')
@Controller({
  path: 'audit/integrations/keka',
  version: '1',
})
export class AuditIntegrationsController {
  constructor(
    private readonly kekaIntegrationAdminService: KekaIntegrationAdminService,
    private readonly kekaSyncService: KekaSyncService,
    private readonly kekaConnectionService: KekaConnectionService,
  ) {}

  @CheckModulePermission('audit', 'view')
  @Get('connection')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionResponseDto })
  getConnection(): Promise<KekaConnectionResponseDto> {
    return this.kekaConnectionService.getConnectionView();
  }

  @CheckModulePermission('integrations', 'configure')
  @Get('connection/secrets')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionSecretsDto })
  getConnectionSecrets(): Promise<KekaConnectionSecretsDto> {
    return this.kekaConnectionService.getConnectionSecrets();
  }

  @CheckModulePermission('integrations', 'configure')
  @Put('connection')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionResponseDto })
  updateConnection(
    @Body() dto: UpdateKekaConnectionDto,
    @Request() request: RequestWithUser,
  ): Promise<KekaConnectionResponseDto> {
    return this.kekaConnectionService.updateConnection(dto, request.user!.id);
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('connection/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionTestResultDto })
  testConnection(
    @Body() dto: UpdateKekaConnectionDto,
    @Request() request: RequestWithUser,
  ): Promise<KekaConnectionTestResultDto> {
    return this.kekaConnectionService.testConnection(request.user!.id, dto);
  }

  @CheckModulePermission('audit', 'view')
  @Get('sync-status')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncStatusResponseDto })
  getSyncStatus(): Promise<KekaSyncStatusResponseDto> {
    return this.kekaIntegrationAdminService.getSyncStatus();
  }

  @CheckModulePermission('audit', 'view')
  @Get('sync-jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncJobStatusDto })
  getSyncJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<KekaSyncJobStatusDto> {
    return this.kekaSyncService.getSyncJobStatus(jobId);
  }

  @CheckModulePermission('audit', 'view')
  @Get('sync-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncLogListResponseDto })
  listSyncLogs(
    @Query() query: QueryKekaSyncLogsDto,
  ): Promise<KekaSyncLogListResponseDto> {
    return this.kekaIntegrationAdminService.listSyncLogs(query);
  }

  @CheckModulePermission('audit', 'view')
  @Get('failed-syncs')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FailedSyncRecordListResponseDto })
  listFailedSyncs(
    @Query() query: QueryFailedSyncRecordsDto,
  ): Promise<FailedSyncRecordListResponseDto> {
    return this.kekaIntegrationAdminService.listFailedSyncRecords(query);
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RetryKekaSyncResultDto })
  retrySync(
    @Body() dto: RetryKekaSyncDto,
    @Request() request: RequestWithUser,
  ): Promise<RetryKekaSyncResultDto> {
    return this.kekaIntegrationAdminService.retryFailedSync(
      {
        failedSyncRecordId: dto.failedSyncRecordId,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
      request.user!.id,
    );
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/employees')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncEmployees(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueEmployeesSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncLeave(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueLeaveSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/attendance')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncAttendance(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueAttendanceSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/holidays')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncHolidays(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueHolidaysSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/salary')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncSalary(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueSalarySync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/clients')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncClients(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueClientsSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/projects')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncProjects(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueProjectsSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  syncAll(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueFullSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('timesheet-reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetReconcileResponseDto })
  reconcileTimesheets(
    @Body() body: QueryTimesheetReconcileDto,
  ): Promise<TimesheetReconcileResponseDto> {
    return this.kekaIntegrationAdminService.reconcileTimesheets(body);
  }

  @CheckModulePermission('audit', 'view')
  @Get('timesheet-reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetReconcileResponseDto })
  getTimesheetReconcile(
    @Query() query: QueryTimesheetReconcileDto,
  ): Promise<TimesheetReconcileResponseDto> {
    return this.kekaIntegrationAdminService.reconcileTimesheets({
      ...query,
      notifyAdmins: false,
    });
  }
}
