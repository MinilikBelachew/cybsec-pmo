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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
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
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

const PROJECT_READ_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
  RoleEnum.engineer,
  RoleEnum.finance,
  RoleEnum.sales,
];

const PROJECT_WRITE_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
];

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Projects')
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles(...PROJECT_WRITE_ROLES)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectDto })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() request: { user: JwtPayloadType },
  ): Promise<ProjectDto> {
    return this.projectsService.create(createProjectDto, request.user.id);
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get('meta/departments')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [DepartmentDto] })
  findDepartments(): Promise<DepartmentDto[]> {
    return this.projectsService.findDepartments();
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get('meta/customers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [CustomerDto] })
  findCustomers(): Promise<CustomerDto[]> {
    return this.projectsService.findCustomers();
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get('meta/project-managers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ProjectManagerDto] })
  findProjectManagers(): Promise<ProjectManagerDto[]> {
    return this.projectsService.findProjectManagers();
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(ProjectDto) })
  async findAll(
    @Query() query: QueryProjectDto,
  ): Promise<InfinityPaginationResponseDto<ProjectDto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.projectsService.findManyWithPagination({ page, limit }),
      { page, limit },
    );
  }

  @Roles(...PROJECT_READ_ROLES)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  findOne(@Param('id') id: string): Promise<NullableType<ProjectDto>> {
    return this.projectsService.findById(id);
  }

  @Roles(...PROJECT_WRITE_ROLES)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() request: { user: JwtPayloadType },
  ): Promise<ProjectDto> {
    return this.projectsService.update(id, updateProjectDto, request.user.id);
  }

  @Roles(RoleEnum.super_admin, RoleEnum.pmo_lead)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(
    @Param('id') id: string,
    @Request() request: { user: JwtPayloadType },
  ): Promise<void> {
    return this.projectsService.remove(id, request.user.id);
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
