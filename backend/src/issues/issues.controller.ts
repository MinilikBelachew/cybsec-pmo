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
import { CheckAnyModulePermission } from '../casl/decorators/check-any-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { CloseIssueDto, UpdateIssueDto } from './dto/update-issue.dto';
import { IssueDto } from './dto/issue.dto';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ version: '1' })
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @CheckAbility('read', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'projects', action: 'view' },
  )
  @Get('issues')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ type: [IssueDto] })
  listPortfolio(
    @Request() request: RequestWithAbility,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ): Promise<IssueDto[]> {
    return this.issuesService.listPortfolio(request.caslUser!, {
      projectId,
      status,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'projects', action: 'view' },
  )
  @Get('projects/:projectId/issues')
  @ApiOkResponse({ type: [IssueDto] })
  listForProject(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ): Promise<IssueDto[]> {
    return this.issuesService.listForProject(projectId, request.caslUser!);
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('issues', 'edit')
  @Post('projects/:projectId/issues')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: IssueDto })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @Request() request: RequestWithAbility,
  ): Promise<IssueDto> {
    return this.issuesService.createForProject(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('issues', 'edit')
  @Patch('projects/:projectId/issues/:issueId')
  @ApiOkResponse({ type: IssueDto })
  update(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @Request() request: RequestWithAbility,
  ): Promise<IssueDto> {
    return this.issuesService.updateForProject(
      projectId,
      issueId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('issues', 'edit')
  @Patch('projects/:projectId/issues/:issueId/close')
  @ApiOkResponse({ type: IssueDto })
  close(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: CloseIssueDto,
    @Request() request: RequestWithAbility,
  ): Promise<IssueDto> {
    return this.issuesService.closeForProject(
      projectId,
      issueId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('issues', 'edit')
  @Delete('projects/:projectId/issues/:issueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.issuesService.removeForProject(
      projectId,
      issueId,
      request.caslUser!,
    );
  }
}
