import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CheckAnyModulePermission } from '../casl/decorators/check-any-module-permission.decorator';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { DashboardService } from './dashboard.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Dashboard')
@Controller({
  path: 'dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @CheckAnyModulePermission(
    { module: 'projects', action: 'view' },
    { module: 'tasks', action: 'view' },
    { module: 'reports', action: 'view' },
  )
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats(@Request() request: RequestWithAbility) {
    return this.dashboardService.getStats(request.caslUser!);
  }

  @CheckModulePermission('projects', 'view')
  @Get('project-health')
  @HttpCode(HttpStatus.OK)
  getProjectHealth(@Request() request: RequestWithAbility) {
    return this.dashboardService.getProjectHealth(request.caslUser!);
  }

  @CheckAnyModulePermission(
    { module: 'projects', action: 'view' },
    { module: 'milestones', action: 'view' },
  )
  @Get('milestones')
  @HttpCode(HttpStatus.OK)
  getMilestones(@Request() request: RequestWithAbility) {
    return this.dashboardService.getMilestones(request.caslUser!);
  }

  @CheckAnyModulePermission(
    { module: 'team', action: 'view' },
    { module: 'reports', action: 'view' },
  )
  @Get('resources')
  @HttpCode(HttpStatus.OK)
  getResources(@Request() request: RequestWithAbility) {
    return this.dashboardService.getResources(request.caslUser!);
  }

  @CheckModulePermission('financials', 'view')
  @Get('burn-rate')
  @HttpCode(HttpStatus.OK)
  getBurnRate(@Request() request: RequestWithAbility) {
    return this.dashboardService.getBurnRate(request.caslUser!);
  }

  @CheckModulePermission('audit', 'view')
  @Get('audit-feed')
  @HttpCode(HttpStatus.OK)
  getAuditFeed(@Request() request: RequestWithAbility) {
    return this.dashboardService.getAuditFeed(request.caslUser!);
  }
}
