import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { LessonsService } from './lessons.service';
import {
  CreateLessonDto,
  LessonDto,
  UpdateLessonDto,
} from './dto/lesson.dto';

@ApiTags('Lessons Learned')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ path: 'lessons', version: '1' })
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get()
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiOkResponse({ type: [LessonDto] })
  list(
    @Request() request: RequestWithAbility,
    @Query('category') category?: string,
    @Query('projectId') projectId?: string,
    @Query('q') q?: string,
    @Query('tag') tag?: string,
  ): Promise<LessonDto[]> {
    return this.lessonsService.list(request.caslUser!, {
      category,
      projectId,
      q,
      tag,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get('surface')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiOkResponse({ type: [LessonDto] })
  surface(
    @Request() request: RequestWithAbility,
    @Query('projectId') projectId?: string,
    @Query('category') category?: string,
    @Query('departmentId') departmentId?: string,
  ): Promise<LessonDto[]> {
    return this.lessonsService.surface(request.caslUser!, {
      projectId,
      category,
      departmentId,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  @Get(':id')
  @ApiOkResponse({ type: LessonDto })
  getOne(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<LessonDto> {
    return this.lessonsService.getById(id, request.caslUser!);
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: LessonDto })
  create(
    @Body() dto: CreateLessonDto,
    @Request() request: RequestWithAbility,
  ): Promise<LessonDto> {
    return this.lessonsService.create(
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  @Put(':id')
  @ApiOkResponse({ type: LessonDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @Request() request: RequestWithAbility,
  ): Promise<LessonDto> {
    return this.lessonsService.update(id, dto, request.caslUser!);
  }
}
