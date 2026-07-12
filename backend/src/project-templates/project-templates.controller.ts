import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { ProjectTemplatesService } from './project-templates.service';
import { SaveProjectTemplateDto } from './dto/save-project-template.dto';
import { InstantiateProjectTemplateDto } from './dto/instantiate-project-template.dto';
import { ProjectTemplateDto } from './dto/project-template.dto';
import { ProjectDto } from '../projects/dto/project.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Project Templates')
@Controller({
  path: 'project-templates',
  version: '1',
})
export class ProjectTemplatesController {
  constructor(private readonly templatesService: ProjectTemplatesService) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('project_templates', 'view')
  @Get()
  @ApiOkResponse({ type: [ProjectTemplateDto] })
  list(@Request() request: RequestWithAbility): Promise<ProjectTemplateDto[]> {
    return this.templatesService.list(request.caslUser!);
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('project_templates', 'view')
  @Get(':id')
  @ApiOkResponse({ type: ProjectTemplateDto })
  getOne(@Param('id') id: string): Promise<ProjectTemplateDto> {
    return this.templatesService.getOne(id);
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_templates', 'manage')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectTemplateDto })
  saveFromProject(
    @Body() dto: SaveProjectTemplateDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectTemplateDto> {
    return this.templatesService.saveFromProject(
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_templates', 'instantiate')
  @Post(':id/instantiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectDto })
  instantiate(
    @Param('id') id: string,
    @Body() dto: InstantiateProjectTemplateDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.templatesService.instantiate(id, dto, request.user!.id);
  }
}
