import { Controller, Get, HttpCode, HttpStatus, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslGuard } from '../casl/casl.guard';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { RequestWithAbility } from '../casl/casl.guard';
import { DashboardService } from './dashboard.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Dashboard')
@Controller({
  path: 'dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @CheckAbility('read', 'Project')
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats(@Request() request: RequestWithAbility) {
    return this.dashboardService.getStats(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('project-health')
  @HttpCode(HttpStatus.OK)
  getProjectHealth(@Request() request: RequestWithAbility) {
    return this.dashboardService.getProjectHealth(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('milestones')
  @HttpCode(HttpStatus.OK)
  getMilestones(@Request() request: RequestWithAbility) {
    return this.dashboardService.getMilestones(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('resources')
  @HttpCode(HttpStatus.OK)
  getResources(@Request() request: RequestWithAbility) {
    return this.dashboardService.getResources(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('burn-rate')
  @HttpCode(HttpStatus.OK)
  getBurnRate(@Request() request: RequestWithAbility) {
    return this.dashboardService.getBurnRate(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('audit-feed')
  @HttpCode(HttpStatus.OK)
  getAuditFeed() {
    return this.dashboardService.getAuditFeed();
  }
}
