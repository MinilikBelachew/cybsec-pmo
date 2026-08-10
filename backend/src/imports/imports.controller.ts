import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { resolveCaslUser } from '../casl/casl-user.util';
import { PrismaService } from '../database/prisma.service';
import { ImportsJobsService } from './imports-jobs.service';
import { ExcelTasksPreviewService } from './excel-tasks-preview.service';
import { ExcelProjectsPreviewService } from './excel-projects-preview.service';
import {
  ActiveImportJobDto,
  ImportEnqueueResultDto,
  ImportJobStatusDto,
  QueuedImportStatusDto,
} from './dto/import-job-status.dto';
import { ExcelTasksImportDto } from './dto/excel-tasks-import.dto';
import { ExcelProjectsImportDto } from './dto/excel-projects-import.dto';
import {
  ExcelTasksPreviewResultDto,
  PreviewExcelTasksDto,
  ExcelTasksPreviewPageQueryDto,
  PatchExcelTasksPreviewRowDto,
  ConfirmExcelTasksPreviewDto,
} from './dto/excel-tasks-preview.dto';
import {
  ConfirmExcelProjectsPreviewDto,
  ExcelProjectsPreviewPageQueryDto,
  PatchExcelProjectsPreviewRowDto,
} from './dto/excel-projects-preview.dto';

const EXCEL_TASKS_PREVIEW_BODY = {
  type: 'object',
  required: ['file', 'projectId'],
  properties: {
    projectId: { type: 'string', format: 'uuid' },
    file: { type: 'string', format: 'binary' },
  },
};

const EXCEL_PROJECTS_PREVIEW_BODY = {
  type: 'object',
  required: ['file'],
  properties: {
    file: { type: 'string', format: 'binary' },
  },
};

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Imports')
@Controller({
  path: 'imports',
  version: '1',
})
export class ImportsController {
  constructor(
    private readonly importsJobsService: ImportsJobsService,
    private readonly excelTasksPreviewService: ExcelTasksPreviewService,
    private readonly excelProjectsPreviewService: ExcelProjectsPreviewService,
    private readonly prisma: PrismaService,
  ) {}

  @CheckAbility('read', 'Project')
  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActiveImportJobDto })
  async getActive(
    @Request() request: RequestWithAbility,
  ): Promise<ActiveImportJobDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.importsJobsService.getActiveImport(user.id);
  }

  @CheckAbility('read', 'Project')
  @Get('queued/:queueId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: QueuedImportStatusDto })
  async getQueued(
    @Request() request: RequestWithAbility,
    @Param('queueId') queueId: string,
  ): Promise<QueuedImportStatusDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.importsJobsService.getQueuedImportStatus(queueId, user.id);
  }

  @CheckAbility('read', 'Project')
  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportJobStatusDto })
  async getJobStatus(
    @Request() request: RequestWithAbility,
    @Param('jobId') jobId: string,
  ): Promise<ImportJobStatusDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.importsJobsService.getJobStatus(jobId, user.id);
  }

  @CheckAbility('create', 'Task')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/tasks/preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: EXCEL_TASKS_PREVIEW_BODY })
  @ApiOkResponse({ type: ExcelTasksPreviewResultDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async previewExcelTasks(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: PreviewExcelTasksDto,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelTasksPreviewService.preview(user, dto.projectId, file);
  }

  @CheckAbility('create', 'Task')
  @CheckModulePermission('project_import', 'import')
  @Get('excel/tasks/preview/:previewId')
  @HttpCode(HttpStatus.OK)
  async pageExcelTasksPreview(
    @Request() request: RequestWithAbility,
    @Param('previewId') previewId: string,
    @Query() query: ExcelTasksPreviewPageQueryDto,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelTasksPreviewService.getPage(
      user.id,
      previewId,
      query.offset ?? 0,
      query.limit ?? 50,
    );
  }

  @CheckAbility('create', 'Task')
  @CheckModulePermission('project_import', 'import')
  @Patch('excel/tasks/preview/:previewId/row')
  @HttpCode(HttpStatus.OK)
  async patchExcelTasksPreviewRow(
    @Request() request: RequestWithAbility,
    @Param('previewId') previewId: string,
    @Body() body: PatchExcelTasksPreviewRowDto,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelTasksPreviewService.patchRow(
      user.id,
      previewId,
      body.index,
      body.patch,
    );
  }

  @CheckAbility('create', 'Task')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/tasks/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ImportEnqueueResultDto })
  async confirmExcelTasksPreview(
    @Request() request: RequestWithAbility,
    @Body() dto: ConfirmExcelTasksPreviewDto,
  ): Promise<ImportEnqueueResultDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelTasksPreviewService.confirm(user.id, dto.previewId);
  }

  @CheckAbility('create', 'Task')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/tasks')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ImportEnqueueResultDto })
  async startExcelTasks(
    @Request() request: RequestWithAbility,
    @Body() dto: ExcelTasksImportDto,
  ): Promise<ImportEnqueueResultDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.importsJobsService.enqueueExcelTasksImport(user.id, dto);
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/projects/preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: EXCEL_PROJECTS_PREVIEW_BODY })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async previewExcelProjects(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelProjectsPreviewService.preview(user, file);
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Get('excel/projects/preview/:previewId')
  @HttpCode(HttpStatus.OK)
  async pageExcelProjectsPreview(
    @Request() request: RequestWithAbility,
    @Param('previewId') previewId: string,
    @Query() query: ExcelProjectsPreviewPageQueryDto,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelProjectsPreviewService.getPage(
      user.id,
      previewId,
      query.entity,
      query.offset ?? 0,
      query.limit ?? 50,
      query.projectName,
    );
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Patch('excel/projects/preview/:previewId/row')
  @HttpCode(HttpStatus.OK)
  async patchExcelProjectsPreviewRow(
    @Request() request: RequestWithAbility,
    @Param('previewId') previewId: string,
    @Body() body: PatchExcelProjectsPreviewRowDto,
  ) {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelProjectsPreviewService.patchRow(user.id, previewId, body);
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/projects/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ImportEnqueueResultDto })
  async confirmExcelProjectsPreview(
    @Request() request: RequestWithAbility,
    @Body() dto: ConfirmExcelProjectsPreviewDto,
  ): Promise<ImportEnqueueResultDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.excelProjectsPreviewService.confirm(user.id, dto.previewId);
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('excel/projects')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ImportEnqueueResultDto })
  async startExcelProjects(
    @Request() request: RequestWithAbility,
    @Body() dto: ExcelProjectsImportDto,
  ): Promise<ImportEnqueueResultDto> {
    const user = await resolveCaslUser(this.prisma, request);
    return this.importsJobsService.enqueueExcelProjectsImport(user.id, dto);
  }
}
