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
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { CreateTaskBundleDto } from './dto/create-task-bundle.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../utils/infinity-pagination';

const TASK_READ_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
  RoleEnum.engineer,
  RoleEnum.finance,
  RoleEnum.sales,
  RoleEnum.client,
  RoleEnum.vendor,
];

const TASK_WRITE_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
  RoleEnum.engineer,
];

const TASK_ATTACHMENT_DELETE_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
];

type AuthRequest = { user: JwtPayloadType & { role?: { code?: string }; roleCode?: string } };

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Tasks')
@Controller({
  path: 'tasks',
  version: '1',
})
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  private viewerRole(request: AuthRequest): string | undefined {
    return request.user.role?.code || request.user.roleCode;
  }

  @Roles(...TASK_WRITE_ROLES)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTaskDto: CreateTaskDto, @Request() request: AuthRequest) {
    return this.tasksService.create(
      createTaskDto,
      request.user.id,
      this.viewerRole(request),
    );
  }

  @Roles(...TASK_WRITE_ROLES)
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

  @Roles(...TASK_READ_ROLES)
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
        this.viewerRole(request),
      ),
      { page, limit },
    );
  }

  @Roles(...TASK_READ_ROLES)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.findById(id, this.viewerRole(request));
  }

  @Roles(...TASK_READ_ROLES)
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
      this.viewerRole(request),
    );
  }

  @Roles(RoleEnum.super_admin, RoleEnum.pmo_lead, RoleEnum.pm)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.remove(id, request.user.id);
  }

  @Roles(...TASK_READ_ROLES)
  @Get(':id/comments')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  getComments(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.getComments(id, this.viewerRole(request));
  }

  @Roles(...TASK_WRITE_ROLES)
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
      this.viewerRole(request),
    );
  }

  @Roles(...TASK_READ_ROLES)
  @Get(':id/attachments')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  getAttachments(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.tasksService.getAttachments(id, this.viewerRole(request));
  }

  @Roles(...TASK_WRITE_ROLES)
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
      this.viewerRole(request),
    );
  }

  @Roles(...TASK_ATTACHMENT_DELETE_ROLES)
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
