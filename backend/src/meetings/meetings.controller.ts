import {
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
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { MeetingInput, MeetingsService } from './meetings.service';

@ApiTags('Meetings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ path: 'projects/:projectId/meetings', version: '1' })
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  list(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.list(projectId, request.caslUser!);
  }

  @Get('moms')
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  listMoms(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.listMoms(projectId, request.caslUser!);
  }

  @Get('moms/:momId')
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  getMom(
    @Param('projectId') projectId: string,
    @Param('momId') momId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.getMom(projectId, momId, request.caslUser!);
  }

  @Get('moms/:momId/export')
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  async exportMom(
    @Param('projectId') projectId: string,
    @Param('momId') momId: string,
    @Query('format') format: 'pdf' | 'docx' = 'pdf',
    @Request() request: RequestWithAbility,
    @Res() response: Response,
  ) {
    const buffer =
      format === 'docx'
        ? await this.meetings.exportMomDocx(
            projectId,
            momId,
            request.caslUser!,
          )
        : await this.meetings.exportMomPdf(
            projectId,
            momId,
            request.caslUser!,
          );
    response
      .type(
        format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      )
      .attachment(`mom-${momId}.${format}`)
      .send(buffer);
  }

  @Post('moms/:momId/review')
  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  reviewMom(
    @Param('projectId') projectId: string,
    @Param('momId') momId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.reviewMom(
      projectId,
      momId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @Post('moms/:momId/acknowledge')
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  acknowledgeMom(
    @Param('projectId') projectId: string,
    @Param('momId') momId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.acknowledgeMom(
      projectId,
      momId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @Get(':meetingId')
  @CheckAbility('read', 'Project')
  @CheckModulePermission('projects', 'view')
  get(
    @Param('projectId') projectId: string,
    @Param('meetingId') meetingId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.get(projectId, meetingId, request.caslUser!);
  }

  @Post()
  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  create(
    @Param('projectId') projectId: string,
    @Body() body: MeetingInput,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.create(
      projectId,
      body,
      request.user!.id,
      request.caslUser!,
    );
  }

  @Patch(':meetingId')
  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  update(
    @Param('projectId') projectId: string,
    @Param('meetingId') meetingId: string,
    @Body() body: Partial<MeetingInput>,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.update(projectId, meetingId, body, request.caslUser!);
  }

  @Delete(':meetingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  remove(
    @Param('projectId') projectId: string,
    @Param('meetingId') meetingId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.remove(projectId, meetingId, request.caslUser!);
  }

  @Post(':meetingId/mom')
  @CheckAbility('update', 'Project')
  @CheckModulePermission('projects', 'edit')
  generateMom(
    @Param('projectId') projectId: string,
    @Param('meetingId') meetingId: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.meetings.generateMom(projectId, meetingId, request.caslUser!);
  }
}
