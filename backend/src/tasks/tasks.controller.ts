import {
  BadRequestException,
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { TasksService } from './tasks.service';
import { TaskProgressService } from './task-progress.service';
import { TaskDependenciesService } from './task-dependencies.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkTasksDto } from './dto/bulk-tasks.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import {
  CreateTaskChecklistItemDto,
  UpdateTaskChecklistItemDto,
  TaskChecklistItemDto,
  TaskChecklistProgressDto,
} from './dto/task-checklist.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { CreateTaskBundleDto } from './dto/create-task-bundle.dto';
import { UpdateTaskBundleDto } from './dto/update-task-bundle.dto';
import { CreateProgressUpdateDto } from './dto/create-progress-update.dto';
import { ReviewProgressUpdateDto } from './dto/review-progress-update.dto';
import { QueryProgressReviewDto } from './dto/query-progress-review.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { UpdateTaskDependencyDto } from './dto/update-task-dependency.dto';
import { QueryTaskDependencyDto } from './dto/query-task-dependency.dto';
import { ValidateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { infinityPagination } from '../utils/infinity-pagination';

type AuthRequest = RequestWithAbility & {
  user: { id: string; role?: { code?: string } };
};

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Tasks')
@Controller({
  path: 'tasks',
  version: '1',
})
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskProgressService: TaskProgressService,
    private readonly taskDependenciesService: TaskDependenciesService,
  ) {}

  private viewerRole(request: AuthRequest): string | undefined {
    return request.user.role?.code;
  }

  @CheckAbility('create', 'Task')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTaskDto: CreateTaskDto, @Request() request: AuthRequest) {
    return this.tasksService.create(
      createTaskDto,
      request.user.id,
      this.viewerRole(request),
    );
  }

  @CheckAbility('create', 'Task')
  @Post('bundle')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 20))
  async createBundle(
    @Body('payload') payloadJson: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() request: AuthRequest,
  ) {
    const dto = await this.parseBundlePayload(payloadJson);
    return this.tasksService.createBundle(
      dto,
      files ?? [],
      request.user.id,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@Body() dto: BulkTasksDto, @Request() request: AuthRequest) {
    return this.tasksService.bulk(
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('read', 'Task')
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryTaskDto, @Request() request: AuthRequest) {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const listQuery = { ...query, page, limit };

    const [tasks, total] = await Promise.all([
      this.tasksService.findManyWithPagination(
        listQuery,
        request.caslUser!,
        request.ability!,
        this.viewerRole(request),
      ),
      this.tasksService.countMany(listQuery, request.caslUser!),
    ]);

    return {
      ...infinityPagination(tasks, { page, limit }),
      meta: { total },
    };
  }

  @CheckAbility('read', 'Task')
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getActiveTaskStats(@Request() request: AuthRequest) {
    return this.tasksService.getActiveTaskStats(request.caslUser!);
  }

  @CheckAbility('read', 'Task')
  @Get('export')
  @HttpCode(HttpStatus.OK)
  async export(@Query() query: QueryTaskDto, @Request() request: AuthRequest) {
    return this.tasksService.findManyForExport(
      query,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('read', 'Task')
  @Get('progress-reviews/pending')
  @HttpCode(HttpStatus.OK)
  findPendingProgressReviews(
    @Query() query: QueryProgressReviewDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskProgressService.findPendingReview(
      query,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('read', 'Project')
  @Get('dependencies')
  @HttpCode(HttpStatus.OK)
  listDependencies(
    @Query() query: QueryTaskDependencyDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskDependenciesService.findMany(
      query,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('approve', 'Project')
  @Post('dependencies/validate')
  @HttpCode(HttpStatus.OK)
  validateDependency(
    @Body() dto: ValidateTaskDependencyDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskDependenciesService.validate(
      dto,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('update', 'Project')
  @Post('dependencies')
  @HttpCode(HttpStatus.CREATED)
  createDependency(
    @Body() dto: CreateTaskDependencyDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskDependenciesService.create(
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('update', 'Project')
  @Patch('dependencies/:dependencyId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'dependencyId', type: String, required: true })
  updateDependency(
    @Param('dependencyId') dependencyId: string,
    @Body() dto: UpdateTaskDependencyDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskDependenciesService.update(
      dependencyId,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('update', 'Project')
  @Delete('dependencies/:dependencyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiParam({ name: 'dependencyId', type: String, required: true })
  removeDependency(
    @Param('dependencyId') dependencyId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskDependenciesService.remove(
      dependencyId,
      request.user.id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('read', 'Task')
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.findById(
      id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Patch(':id/bundle')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiParam({ name: 'id', type: String, required: true })
  async updateBundle(
    @Param('id') id: string,
    @Body('payload') payloadJson: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() request: AuthRequest,
  ) {
    const dto = await this.parseUpdateBundlePayload(payloadJson);
    return this.tasksService.updateBundle(
      id,
      dto,
      files ?? [],
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.update(
      id,
      updateTaskDto,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.remove(id, request.user.id, request.caslUser!, request.ability!);
  }

  @CheckAbility('read', 'Task')
  @Get(':id/checklist-items')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TaskChecklistProgressDto })
  @ApiParam({ name: 'id', type: String, required: true })
  getChecklist(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.getChecklist(
      id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Post(':id/checklist-items')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TaskChecklistItemDto })
  @ApiParam({ name: 'id', type: String, required: true })
  addChecklistItem(
    @Param('id') id: string,
    @Body() dto: CreateTaskChecklistItemDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.addChecklistItem(
      id,
      dto,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Patch(':id/checklist-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TaskChecklistItemDto })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'itemId', type: String, required: true })
  updateChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTaskChecklistItemDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.updateChecklistItem(
      id,
      itemId,
      dto,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Delete(':id/checklist-items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'itemId', type: String, required: true })
  removeChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.removeChecklistItem(
      id,
      itemId,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('read', 'Task')
  @Get(':id/comments')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  getComments(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.getComments(
      id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.addComment(
      id,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Patch(':id/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'commentId', type: String, required: true })
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskCommentDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.updateComment(
      id,
      commentId,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'commentId', type: String, required: true })
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.removeComment(
      id,
      commentId,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('read', 'Task')
  @Get(':id/attachments')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  getAttachments(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.getAttachments(
      id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateTaskAttachmentDto,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.addAttachment(
      id,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'attachmentId', type: String, required: true })
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() request: AuthRequest,
  ) {
    return this.tasksService.removeAttachment(
      id,
      attachmentId,
      request.caslUser!,
      request.ability!,
      this.viewerRole(request),
    );
  }

  @CheckAbility('update', 'Task')
  @Post(':id/progress-updates')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  submitProgressUpdate(
    @Param('id') id: string,
    @Body() dto: CreateProgressUpdateDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskProgressService.submit(
      id,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('read', 'Task')
  @Get(':id/progress-updates')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  listProgressUpdates(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.taskProgressService.findForTask(
      id,
      request.caslUser!,
      request.ability!,
    );
  }

  @CheckAbility('approve', 'Task')
  @Patch(':id/progress-updates/:updateId/review')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'updateId', type: String, required: true })
  reviewProgressUpdate(
    @Param('id') id: string,
    @Param('updateId') updateId: string,
    @Body() dto: ReviewProgressUpdateDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskProgressService.review(
      id,
      updateId,
      dto,
      request.user.id,
      request.caslUser!,
      request.ability!,
    );
  }

  private async parseBundlePayload(payloadJson: string): Promise<CreateTaskBundleDto> {
    if (!payloadJson) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { payload: 'payloadRequired' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { payload: 'invalidJson' },
      });
    }

    const dto = plainToInstance(CreateTaskBundleDto, parsed);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const error of errors) {
        if (error.constraints) {
          fieldErrors[error.property] = Object.values(error.constraints)[0];
        }
      }
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: fieldErrors,
      });
    }

    return dto;
  }

  private async parseUpdateBundlePayload(payloadJson: string): Promise<UpdateTaskBundleDto> {
    if (!payloadJson) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { payload: 'payloadRequired' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { payload: 'invalidJson' },
      });
    }

    const dto = plainToInstance(UpdateTaskBundleDto, parsed);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const error of errors) {
        if (error.constraints) {
          fieldErrors[error.property] = Object.values(error.constraints)[0];
        }
      }
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: fieldErrors,
      });
    }

    return dto;
  }
}
