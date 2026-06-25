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
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { CreateTaskBundleDto } from './dto/create-task-bundle.dto';
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
  constructor(private readonly tasksService: TasksService) {}

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

  @CheckAbility('read', 'Task')
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryTaskDto, @Request() request: AuthRequest) {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.tasksService.findManyWithPagination(
        { ...query, page, limit },
        request.caslUser!,
        request.ability!,
        this.viewerRole(request),
      ),
      { page, limit },
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
}
