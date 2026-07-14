import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
  QueryFailedSyncRecordsDto,
  QueryKekaSyncLogsDto,
  RetryKekaSyncDto,
  RetryKekaSyncResultDto,
} from '../integrations/keka/dto/keka-integration.dto';
import { KekaIntegrationAdminService } from '../integrations/keka/keka-integration-admin.service';
import { KekaSyncEnqueueResultDto } from '../integrations/keka/dto/keka-sync.dto';
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
  ) {}

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
}
