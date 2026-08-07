import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { RequestWithAbility } from '../casl/casl.guard';
import { resolveCaslUser } from '../casl/casl-user.util';
import { PrismaService } from '../database/prisma.service';
import { CreateMppImportDto } from './dto/create-mpp-import.dto';
import { CreateMppPortfolioImportDto } from './dto/create-mpp-portfolio-import.dto';
import { PreviewMppImportDto } from './dto/preview-mpp-import.dto';
import { MppImportPreviewDto } from './dto/mpp-import-preview.dto';
import { MPP_IMPORT_ALLOWED_EXTENSIONS } from './mpp-import.constants';
import { MppImportService } from './mpp-import.service';
import { ImportsJobsService } from '../imports/imports-jobs.service';
import { ImportEnqueueResultDto } from '../imports/dto/import-job-status.dto';

const UPLOAD_BODY_SCHEMA = {
  type: 'object',
  required: ['file', 'projectId'],
  properties: {
    projectId: { type: 'string', format: 'uuid' },
    file: { type: 'string', format: 'binary' },
  },
};

const PORTFOLIO_BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    objective: { type: 'string' },
    departmentId: { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    engagementType: { type: 'string' },
    billingModel: { type: 'string' },
    priority: { type: 'string' },
    value: { type: 'number' },
    currency: { type: 'string' },
    primaryPmId: { type: 'string', format: 'uuid' },
    projectsJson: {
      type: 'string',
      description: 'JSON array of per-project create fields matched by name',
    },
    projects: {
      type: 'string',
      description: 'Deprecated — use projectsJson',
    },
    file: { type: 'string', format: 'binary' },
  },
};

const PREVIEW_BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    projectId: { type: 'string', format: 'uuid' },
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
export class MppImportController {
  constructor(
    private readonly mppImportService: MppImportService,
    private readonly importsJobsService: ImportsJobsService,
    private readonly prisma: PrismaService,
  ) {}

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('mpp/preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: PREVIEW_BODY_SCHEMA })
  @ApiOkResponse({ type: MppImportPreviewDto })
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: PreviewMppImportDto,
  ): Promise<MppImportPreviewDto> {
    this.assertValidFile(file);
    const user = await resolveCaslUser(this.prisma, request);

    return this.mppImportService.preview(
      user,
      dto.projectId,
      file.originalname,
      file.path,
    );
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('mpp')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiCreatedResponse({ type: ImportEnqueueResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMppImportDto,
  ): Promise<ImportEnqueueResultDto> {
    this.assertValidFile(file);
    const user = await resolveCaslUser(this.prisma, request);

    return this.importsJobsService.enqueueMppImport({
      userId: user.id,
      projectId: dto.projectId,
      fileName: file.originalname,
      filePath: file.path,
    });
  }

  @CheckAbility('create', 'Project')
  @CheckModulePermission('project_import', 'import')
  @Post('mpp/portfolio')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: PORTFOLIO_BODY_SCHEMA })
  @ApiCreatedResponse({ type: ImportEnqueueResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async importPortfolio(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMppPortfolioImportDto,
  ): Promise<ImportEnqueueResultDto> {
    this.assertValidFile(file);
    const user = await resolveCaslUser(this.prisma, request);

    return this.importsJobsService.enqueueMppPortfolioImport({
      userId: user.id,
      fileName: file.originalname,
      filePath: file.path,
      portfolioDto: dto,
    });
  }

  @CheckAbility('read', 'Project')
  @CheckModulePermission('project_export', 'export')
  @Get('mspdi/export/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'projectId', type: String })
  @ApiProduces('application/xml')
  @ApiOkResponse({
    description:
      'Microsoft Project XML (MSPDI). Binary .mpp is not supported by MPXJ; MSPDI opens in MS Project.',
  })
  @Header('Content-Type', 'application/xml')
  async exportMspdi(
    @Request() request: RequestWithAbility,
    @Param('projectId') projectId: string,
  ): Promise<StreamableFile> {
    const user = await resolveCaslUser(this.prisma, request);
    const file = await this.mppImportService.exportMspdi(user, projectId);

    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  private assertValidFile(file: Express.Multer.File): void {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'fileRequired' },
      });
    }

    const extension =
      file.originalname.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
    if (
      !MPP_IMPORT_ALLOWED_EXTENSIONS.includes(
        extension as (typeof MPP_IMPORT_ALLOWED_EXTENSIONS)[number],
      )
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'unsupportedMppFileType' },
      });
    }
  }
}
