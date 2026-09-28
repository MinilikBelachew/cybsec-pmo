import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { SowsService } from './sows.service';
import { ApproveSowDto, SowDocumentDto, UpdateSowDto } from './dto/sow.dto';

@ApiTags('SOW')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'projects/:projectId/sow',
  version: '1',
})
export class SowsController {
  constructor(private readonly sowsService: SowsService) {}

  @CheckModulePermission('sow', 'view')
  @Get()
  @ApiOkResponse({ type: SowDocumentDto })
  async get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithAbility,
  ): Promise<SowDocumentDto> {
    return this.sowsService.getForProject(projectId, req.caslUser!);
  }

  @CheckModulePermission('sow', 'view')
  @Get('export')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'SOW PDF' })
  async exportPdf(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithAbility,
    @Res() response: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.sowsService.exportPdf(
      projectId,
      req.caslUser!,
    );
    response.type('application/pdf').attachment(filename).send(buffer);
  }

  @CheckModulePermission('sow', 'edit')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: SowDocumentDto })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithAbility,
  ): Promise<SowDocumentDto> {
    return this.sowsService.createForProject(projectId, req.caslUser!);
  }

  @CheckModulePermission('sow', 'edit')
  @Patch()
  @ApiOkResponse({ type: SowDocumentDto })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateSowDto,
    @Request() req: RequestWithAbility,
  ): Promise<SowDocumentDto> {
    return this.sowsService.updateDraft(projectId, dto, req.caslUser!);
  }

  @CheckModulePermission('sow', 'approve')
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SowDocumentDto })
  async approve(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ApproveSowDto,
    @Request() req: RequestWithAbility,
  ): Promise<SowDocumentDto> {
    return this.sowsService.approve(projectId, dto, req.caslUser!);
  }
}
