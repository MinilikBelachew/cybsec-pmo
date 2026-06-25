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
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { RequestWithAbility } from '../casl/casl.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
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
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { NullableType } from '../utils/types/nullable.type';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Projects')
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @CheckAbility('create', 'Project')
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

  @CheckAbility('read', 'Project')
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(ProjectDto) })
  async findAll(
    @Query() query: QueryProjectDto,
    @Request() request: RequestWithAbility,
  ): Promise<InfinityPaginationResponseDto<ProjectDto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.projectsService.findManyWithPagination(
        { page, limit },
        request.caslUser!,
        request.ability!,
      ),
      { page, limit },
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

  @CheckAbility('update', 'Project')
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

  @CheckAbility('approve', 'Project')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.projectsService.remove(id, request.caslUser!, request.ability!);
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get(':id/phases')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findPhases(@Param('id') id: string) {
    return this.projectsService.findPhases(id);
  }

  @Roles(...PROJECT_WRITE_ROLES)
  @Post(':id/phases')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  createPhase(
    @Param('id') id: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.projectsService.createPhase(id, dto);
  }

  @Roles(...PROJECT_WRITE_ROLES)
  @Patch(':id/phases/:phaseId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'phaseId', type: String, required: true })
  updatePhase(
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.projectsService.updatePhase(phaseId, dto);
  }

  @Roles(RoleEnum.super_admin, RoleEnum.pmo_lead)
  @Delete(':id/phases/:phaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'phaseId', type: String, required: true })
  removePhase(
    @Param('phaseId') phaseId: string,
  ) {
    return this.projectsService.removePhase(phaseId);
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get(':id/milestones')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findMilestones(@Param('id') id: string) {
    return this.projectsService.findMilestones(id);
  }

  @Roles(...PROJECT_WRITE_ROLES)
  @Post(':id/milestones')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  createMilestone(
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectsService.createMilestone(id, dto);
  }

  @Roles(...PROJECT_WRITE_ROLES)
  @Patch(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'milestoneId', type: String, required: true })
  updateMilestone(
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectsService.updateMilestone(milestoneId, dto);
  }

  @Roles(RoleEnum.super_admin, RoleEnum.pmo_lead)
  @Delete(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'milestoneId', type: String, required: true })
  removeMilestone(
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectsService.removeMilestone(milestoneId);
  }
}
