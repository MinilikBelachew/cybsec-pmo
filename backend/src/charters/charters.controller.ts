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
import { ChartersService } from './charters.service';
import {
  ProjectCharterDto,
  UpdateProjectCharterDto,
  ApproveProjectCharterDto,
} from './dto/charter.dto';

@ApiTags('Charters')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'projects/:projectId/charter',
  version: '1',
})
export class ChartersController {
  constructor(private readonly chartersService: ChartersService) {}

  @CheckModulePermission('charter', 'view')
  @Get()
  @ApiOkResponse({ type: ProjectCharterDto })
  async get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithAbility,
  ): Promise<ProjectCharterDto> {
    return this.chartersService.getForProject(projectId, req.caslUser!);
  }

  @CheckModulePermission('charter', 'view')
  @Get('export')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Project charter PDF' })
  async exportPdf(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithAbility,
    @Res() response: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.chartersService.exportPdf(
      projectId,
      req.caslUser!,
    );
    response
      .type('application/pdf')
      .attachment(filename)
      .send(buffer);
  }

  @CheckModulePermission('charter', 'edit')
  @Patch()
  @ApiOkResponse({ type: ProjectCharterDto })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectCharterDto,
    @Request() req: RequestWithAbility,
  ): Promise<ProjectCharterDto> {
    return this.chartersService.updateDraft(projectId, dto, req.caslUser!);
  }

  @CheckModulePermission('charter', 'approve')
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProjectCharterDto })
  async approve(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ApproveProjectCharterDto,
    @Request() req: RequestWithAbility,
  ): Promise<ProjectCharterDto> {
    return this.chartersService.approve(projectId, dto, req.caslUser!);
  }
}
