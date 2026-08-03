import {
  Controller,
  Get,
  Post,
  Query,
  Request,
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
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { ActionPointsService } from './action-points.service';
import { ActionPointDto } from './dto/action-point.dto';
import { ActionPointClosureReportDto } from './dto/closure-report.dto';

@ApiTags('Action Points')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ path: 'actions', version: '1' })
export class ActionPointsPortfolioController {
  constructor(private readonly actionPointsService: ActionPointsService) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sourceType', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiOkResponse({ type: [ActionPointDto] })
  list(
    @Request() request: RequestWithAbility,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('sourceType') sourceType?: string,
    @Query('ownerId') ownerId?: string,
  ): Promise<ActionPointDto[]> {
    return this.actionPointsService.listPortfolio(request.caslUser!, {
      projectId,
      status,
      sourceType,
      ownerId,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get('closure-report')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOkResponse({ type: ActionPointClosureReportDto })
  closureReport(
    @Request() request: RequestWithAbility,
    @Query('projectId') projectId?: string,
  ) {
    return this.actionPointsService.closureReport(request.caslUser!, {
      projectId,
    });
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Post('reminders')
  @ApiOkResponse({
    schema: { properties: { sent: { type: 'number' } } },
  })
  sendReminders(@Request() request: RequestWithAbility) {
    return this.actionPointsService.sendDueReminders(request.caslUser!);
  }
}
