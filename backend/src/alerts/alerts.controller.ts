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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { AlertsService } from './alerts.service';
import {
  AcknowledgeAlertEventDto,
  AlertEventDto,
  AlertRuleDto,
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
} from './dto/alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ path: 'alerts', version: '1' })
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @CheckAbility('manage', 'Notification')
  @CheckModulePermission('notifications', 'manage')
  @Get('catalogue')
  @ApiOkResponse({ type: [AlertRuleDto] })
  listCatalogue(): Promise<AlertRuleDto[]> {
    return this.alertsService.listCatalogue();
  }

  @CheckAbility('manage', 'Notification')
  @CheckModulePermission('notifications', 'manage')
  @Post('catalogue')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: AlertRuleDto })
  create(@Body() dto: CreateAlertRuleDto): Promise<AlertRuleDto> {
    return this.alertsService.createRule(dto);
  }

  @CheckAbility('manage', 'Notification')
  @CheckModulePermission('notifications', 'manage')
  @Put('catalogue/:id')
  @ApiOkResponse({ type: AlertRuleDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
  ): Promise<AlertRuleDto> {
    return this.alertsService.updateRule(id, dto);
  }

  @CheckAbility('manage', 'Notification')
  @CheckModulePermission('notifications', 'manage')
  @Delete('catalogue/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  disable(@Param('id') id: string): Promise<void> {
    return this.alertsService.disableRule(id);
  }

  @CheckAbility('read', 'Notification')
  @CheckModulePermission('notifications', 'view')
  @Get('instances')
  @ApiQuery({ name: 'ruleId', required: false })
  @ApiOkResponse({ type: [AlertEventDto] })
  listInstances(@Query('ruleId') ruleId?: string): Promise<AlertEventDto[]> {
    return this.alertsService.listInstances({ ruleId });
  }

  @CheckAbility('read', 'Notification')
  @CheckModulePermission('notifications', 'view')
  @Patch('instances/:id/acknowledge')
  @ApiOkResponse({ type: AlertEventDto })
  acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeAlertEventDto,
    @Request() request: RequestWithAbility,
  ): Promise<AlertEventDto> {
    return this.alertsService.acknowledge(id, request.user!.id, dto);
  }
}
