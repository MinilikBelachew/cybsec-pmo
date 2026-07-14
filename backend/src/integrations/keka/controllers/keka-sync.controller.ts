import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../../../casl/casl-ability.interceptor';
import { CheckModulePermission } from '../../../casl/decorators/check-module-permission.decorator';
import { CaslGuard } from '../../../casl/casl.guard';
import { ModulePermissionGuard } from '../../../casl/module-permission.guard';
import { PrismaService } from '../../../database/prisma.service';
import {
  KekaSyncEnqueueResultDto,
  KekaSyncLogDto,
  KekaSyncRunResultDto,
} from '../dto/keka-sync.dto';
import { KekaSyncService } from '../sync/keka-sync.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Integrations')
@Controller({
  path: 'integrations/keka',
  version: '1',
})
export class KekaSyncController {
  constructor(
    private readonly kekaSyncService: KekaSyncService,
    private readonly prisma: PrismaService,
  ) {}

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/employees')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncEmployees(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueEmployeesSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncLeave(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueLeaveSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/attendance')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncAttendance(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueAttendanceSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/holidays')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncHolidays(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueHolidaysSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/salary')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncSalary(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueSalarySync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/projects')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncEnqueueResultDto })
  async syncProjects(): Promise<KekaSyncEnqueueResultDto> {
    return this.kekaSyncService.enqueueProjectsSync();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaSyncRunResultDto })
  async syncAll(): Promise<KekaSyncRunResultDto> {
    return this.kekaSyncService.syncAllNow();
  }

  @CheckModulePermission('integrations', 'view')
  @Get('sync/logs')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [KekaSyncLogDto] })
  async listSyncLogs(
    @Query('status') status?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit = '50',
  ): Promise<KekaSyncLogDto[]> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);

    return this.prisma.kekaSyncLog.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        direction: true,
        status: true,
        errorMsg: true,
        retryCount: true,
        createdAt: true,
      },
    });
  }
}
