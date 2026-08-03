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
import { RisksService } from './risks.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { RiskDto } from './dto/risk.dto';

@ApiTags('Risks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ version: '1' })
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('risks', 'view')
  @Get('risks')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ type: [RiskDto] })
  listPortfolio(
    @Request() request: RequestWithAbility,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ): Promise<RiskDto[]> {
    return this.risksService.listPortfolio(request.caslUser!, {
      projectId,
      status,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('risks', 'view')
  @Get('risks/:riskId')
  @ApiOkResponse({ type: RiskDto })
  getOne(
    @Param('riskId') riskId: string,
    @Request() request: RequestWithAbility,
  ): Promise<RiskDto> {
    return this.risksService.getById(riskId, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('risks', 'view')
  @Get('projects/:projectId/risks')
  @ApiOkResponse({ type: [RiskDto] })
  listForProject(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ): Promise<RiskDto[]> {
    return this.risksService.listForProject(projectId, request.caslUser!);
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('risks', 'edit')
  @Post('projects/:projectId/risks')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: RiskDto })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRiskDto,
    @Request() request: RequestWithAbility,
  ): Promise<RiskDto> {
    return this.risksService.createForProject(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('risks', 'edit')
  @Patch('projects/:projectId/risks/:riskId')
  @ApiOkResponse({ type: RiskDto })
  update(
    @Param('projectId') projectId: string,
    @Param('riskId') riskId: string,
    @Body() dto: UpdateRiskDto,
    @Request() request: RequestWithAbility,
  ): Promise<RiskDto> {
    return this.risksService.updateForProject(
      projectId,
      riskId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('risks', 'edit')
  @Patch('projects/:projectId/risks/:riskId/close')
  @ApiOkResponse({ type: RiskDto })
  close(
    @Param('projectId') projectId: string,
    @Param('riskId') riskId: string,
    @Request() request: RequestWithAbility,
  ): Promise<RiskDto> {
    return this.risksService.closeForProject(
      projectId,
      riskId,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('risks', 'edit')
  @Delete('projects/:projectId/risks/:riskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('projectId') projectId: string,
    @Param('riskId') riskId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.risksService.removeForProject(
      projectId,
      riskId,
      request.caslUser!,
    );
  }
}
