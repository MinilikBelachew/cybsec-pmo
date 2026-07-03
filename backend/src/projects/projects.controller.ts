import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CheckAnyModulePermission } from '../casl/decorators/check-any-module-permission.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { RequestWithAbility } from '../casl/casl.guard';
import { ProjectsService } from './projects.service';
import { ProjectTeamService } from './project-team.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectBundleDto } from './dto/create-project-bundle.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import {
  CustomerDto,
  DepartmentDto,
  ProjectDto,
  ProjectManagerDto,
} from './dto/project.dto';
import { QueryTeamCandidatesDto } from './dto/query-team-candidates.dto';
import { QueryTaskAssigneeAvailabilityDto } from './dto/query-task-assignee-availability.dto';
import {
  CreateProjectTeamResultDto,
  ProjectAllocationDto,
  ProjectTaskAssigneeDto,
  TaskAssigneeAvailabilityDto,
  TeamCandidateDto,
} from './dto/project-allocation.dto';
import { CreateProjectTeamDto } from './dto/create-allocation.dto';
import { QueryProjectAuditDto } from '../audit/dto/query-project-audit.dto';
import { AuditLogsService } from '../audit/audit-logs.service';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Projects')
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectTeamService: ProjectTeamService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectDto })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectDto> {
    return this.projectsService.create(createProjectDto, request.user!.id);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'create')
  @Post('bundle')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectDto })
  async createBundle(
    @Body() dto: CreateProjectBundleDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectDto> {
    const { allocations, milestones, ...projectDto } = dto;
    const project = await this.projectsService.create(
      { ...projectDto, milestones },
      request.user!.id,
    );

    if (allocations?.length) {
      await this.projectTeamService.addMembers(
        project.id,
        allocations,
        request.user!.id,
        request.caslUser!,
      );
    }

    return project;
  }

  @CheckAbility('read', 'Project')
  @Get('meta/departments')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [DepartmentDto] })
  findDepartments(): Promise<DepartmentDto[]> {
    return this.projectsService.findDepartments();
  }

  @CheckAbility('read', 'Project')
  @Get('meta/customers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [CustomerDto] })
  findCustomers(): Promise<CustomerDto[]> {
    return this.projectsService.findCustomers();
  }

  @CheckAbility('read', 'Project')
  @Get('meta/project-managers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ProjectManagerDto] })
  findProjectManagers(): Promise<ProjectManagerDto[]> {
    return this.projectsService.findProjectManagers();
  }

  @CheckAbility('read', 'Team')
  @Get('meta/team-candidates')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [TeamCandidateDto] })
  findTeamCandidates(
    @Query() query: QueryTeamCandidatesDto,
    @Request() request: RequestWithAbility,
  ): Promise<TeamCandidateDto[]> {
    return this.projectTeamService.findCandidates(query, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get('portfolio-stats')
  @HttpCode(HttpStatus.OK)
  getPortfolioStats(@Request() request: RequestWithAbility) {
    return this.projectsService.getPortfolioStats(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(ProjectDto) })
  async findAll(
    @Query() query: QueryProjectDto,
    @Request() request: RequestWithAbility,
  ): Promise<InfinityPaginationResponseDto<ProjectDto> & {
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    stats: {
      total: number;
      active: number;
      atRisk: number;
      delayed: number;
      completed: number;
      totalValue?: number;
    };
  }> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const result = await this.projectsService.findManyWithPagination(
      { ...query, page, limit },
      request.caslUser!,
      request.ability!,
    );

    const total = result.total;

    return {
      ...infinityPagination(result.data, { page, limit }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      stats: result.stats,
    };
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('project_export', 'export')
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ProjectDto] })
  async export(
    @Query() query: QueryProjectDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectDto[]> {
    return this.projectsService.findManyForExport(
      query,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('read', 'Project')
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  findOne(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<NullableType<ProjectDto>> {
    return this.projectsService.findById(id, request.caslUser!, request.ability!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectDto> {
    return this.projectsService.update(
      id,
      updateProjectDto,
      request.user!.id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'approve')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.projectsService.remove(id, request.caslUser!, request.ability!);
  }

  @CheckAbility('read', 'Project')
  @Get(':id/team/task-availability')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskAssigneeAvailabilityDto })
  checkTaskAssigneeAvailability(
    @Param('id') id: string,
    @Query() query: QueryTaskAssigneeAvailabilityDto,
    @Request() request: RequestWithAbility,
  ): Promise<TaskAssigneeAvailabilityDto> {
    return this.projectTeamService.checkTaskAssigneeAvailability(
      id,
      query,
      request.caslUser!,
    );
  }

  @CheckAbility('read', 'Project')
  @Get(':id/team/assignees')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: [ProjectTaskAssigneeDto] })
  findTaskAssignees(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectTaskAssigneeDto[]> {
    return this.projectTeamService.findTaskAssignees(id, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get(':id/team')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: [ProjectAllocationDto] })
  findProjectTeam(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectAllocationDto[]> {
    return this.projectTeamService.findProjectTeam(id, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Post(':id/team')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: CreateProjectTeamResultDto })
  addProjectTeamMembers(
    @Param('id') id: string,
    @Body() dto: CreateProjectTeamDto,
    @Request() request: RequestWithAbility,
  ): Promise<CreateProjectTeamResultDto> {
    return this.projectTeamService.addMembers(
      id,
      dto.allocations,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Delete(':id/team/:allocationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'allocationId', type: String, required: true })
  removeProjectTeamMember(
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.projectTeamService.removeMember(
      id,
      allocationId,
      request.caslUser!,
    );
  }

  @CheckAbility('read', 'Project')
  @Get(':id/phases')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findPhases(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.findPhases(id, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('phases', 'create')
  @Post(':id/phases')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  createPhase(
    @Param('id') id: string,
    @Body() dto: CreatePhaseDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.createPhase(id, dto, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('phases', 'edit')
  @Patch(':id/phases/:phaseId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'phaseId', type: String, required: true })
  updatePhase(
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.updatePhase(phaseId, dto, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'approve')
  @Delete(':id/phases/:phaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'phaseId', type: String, required: true })
  removePhase(
    @Param('phaseId') phaseId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.removePhase(phaseId, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @Get(':id/milestones')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findMilestones(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.findMilestones(id, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('milestones', 'edit')
  @Post(':id/milestones')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  createMilestone(
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.createMilestone(id, dto, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('milestones', 'edit')
  @Patch(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'milestoneId', type: String, required: true })
  updateMilestone(
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.updateMilestone(milestoneId, dto, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'approve')
  @Delete(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'milestoneId', type: String, required: true })
  removeMilestone(
    @Param('milestoneId') milestoneId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.projectsService.removeMilestone(milestoneId, request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckAnyModulePermission(
    { module: 'audit', action: 'view' },
    { module: 'audit', action: 'view_project' },
  )
  @Get(':id/audit-events')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  async findProjectAuditEvents(
    @Param('id') id: string,
    @Query() query: QueryProjectAuditDto,
    @Request() request: RequestWithAbility,
  ) {
    const project = await this.projectsService.findById(
      id,
      request.caslUser!,
      request.ability!,
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.auditLogsService.findForProject(id, query);
  }
}
