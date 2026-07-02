import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
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
import { PreviewMppImportDto } from './dto/preview-mpp-import.dto';
import { MppImportPreviewDto } from './dto/mpp-import-preview.dto';
import { MppImportResultDto } from './dto/mpp-import-result.dto';
import { MPP_IMPORT_ALLOWED_EXTENSIONS } from './mpp-import.constants';
import { MppImportService } from './mpp-import.service';

const UPLOAD_BODY_SCHEMA = {
  type: 'object',
  required: ['file', 'projectId'],
  properties: {
    projectId: { type: 'string', format: 'uuid' },
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
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiCreatedResponse({ type: MppImportResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Request() request: RequestWithAbility,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMppImportDto,
  ): Promise<MppImportResultDto> {
    this.assertValidFile(file);
    const user = await resolveCaslUser(this.prisma, request);

    return this.mppImportService.import(
      user,
      dto.projectId,
      file.originalname,
      file.path,
    );
  }

  private assertValidFile(file: Express.Multer.File): void {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'fileRequired' },
      });
    }

    const extension = file.originalname.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
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
