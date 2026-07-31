import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { memoryStorage } from 'multer';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { BrandingService } from './branding.service';
import {
  BrandingProfileDto,
  BrandingProfileOptionDto,
  CreateBrandingProfileDto,
  UpdateBrandingProfileDto,
} from './dto/branding-profile.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Branding Profiles')
@Controller({
  path: 'branding-profiles',
  version: '1',
})
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  /** Full list for the Settings tab. */
  @CheckAbility('manage', 'Settings')
  @Get()
  @ApiOkResponse({ type: [BrandingProfileDto] })
  list(): Promise<BrandingProfileDto[]> {
    return this.brandingService.list();
  }

  /** Active profiles for the project form picker. */
  @CheckAbility('read', 'Project')
  @Get('options')
  @ApiOkResponse({ type: [BrandingProfileOptionDto] })
  listOptions(): Promise<BrandingProfileOptionDto[]> {
    return this.brandingService.listOptions();
  }

  @CheckAbility('manage', 'Settings')
  @Get(':id')
  @ApiOkResponse({ type: BrandingProfileDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<BrandingProfileDto> {
    return this.brandingService.get(id);
  }

  @CheckAbility('manage', 'Settings')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: BrandingProfileDto })
  create(
    @Body() dto: CreateBrandingProfileDto,
    @Request() request: RequestWithAbility,
  ): Promise<BrandingProfileDto> {
    return this.brandingService.create(dto, request.user?.id);
  }

  @CheckAbility('manage', 'Settings')
  @Patch(':id')
  @ApiOkResponse({ type: BrandingProfileDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingProfileDto,
    @Request() request: RequestWithAbility,
  ): Promise<BrandingProfileDto> {
    return this.brandingService.update(id, dto, request.user?.id);
  }

  @CheckAbility('manage', 'Settings')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.brandingService.remove(id);
  }

  @CheckAbility('manage', 'Settings')
  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @ApiOkResponse({ type: BrandingProfileDto })
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() request: RequestWithAbility,
  ): Promise<BrandingProfileDto> {
    return this.brandingService.uploadLogo(id, file, request.user?.id);
  }

  @CheckAbility('manage', 'Settings')
  @Delete(':id/logo')
  @ApiOkResponse({ type: BrandingProfileDto })
  clearLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() request: RequestWithAbility,
  ): Promise<BrandingProfileDto> {
    return this.brandingService.clearLogo(id, request.user?.id);
  }
}
