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
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { ActionPointsService } from './action-points.service';
import { CreateActionPointDto } from './dto/create-action-point.dto';
import { UpdateActionPointDto } from './dto/update-action-point.dto';
import { ActionPointDto } from './dto/action-point.dto';

@ApiTags('Action Points')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'projects/:projectId/action-points',
  version: '1',
})
export class ActionPointsController {
  constructor(private readonly actionPointsService: ActionPointsService) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get()
  @ApiOkResponse({ type: [ActionPointDto] })
  list(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ): Promise<ActionPointDto[]> {
    return this.actionPointsService.listForProject(projectId, request.caslUser!);
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ActionPointDto })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateActionPointDto,
    @Request() request: RequestWithAbility,
  ): Promise<ActionPointDto> {
    return this.actionPointsService.createForProject(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Patch(':actionPointId')
  @ApiOkResponse({ type: ActionPointDto })
  update(
    @Param('projectId') projectId: string,
    @Param('actionPointId') actionPointId: string,
    @Body() dto: UpdateActionPointDto,
    @Request() request: RequestWithAbility,
  ): Promise<ActionPointDto> {
    return this.actionPointsService.updateForProject(
      projectId,
      actionPointId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Delete(':actionPointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('projectId') projectId: string,
    @Param('actionPointId') actionPointId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.actionPointsService.removeForProject(
      projectId,
      actionPointId,
      request.caslUser!,
    );
  }
}
