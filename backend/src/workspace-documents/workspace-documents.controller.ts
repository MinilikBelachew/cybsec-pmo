import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WorkspaceDocumentsService } from './workspace-documents.service';
import { CreateWorkspaceDocumentDto } from './dto/create-workspace-document.dto';
import { QueryWorkspaceDocumentDto } from './dto/query-workspace-document.dto';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';

type AuthRequest = RequestWithAbility;

@ApiTags('Workspace Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'projects/:projectId/documents',
  version: '1',
})
export class WorkspaceDocumentsController {
  constructor(private readonly documentsService: WorkspaceDocumentsService) {}

  @CheckAbility('read', 'Project')
  @Get()
  list(
    @Param('projectId') projectId: string,
    @Query() query: QueryWorkspaceDocumentDto,
    @Request() request: AuthRequest,
  ) {
    return this.documentsService.listForProject(
      projectId,
      query,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkspaceDocumentDto,
    @Request() request: AuthRequest,
  ) {
    return this.documentsService.createForProject(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Request() request: AuthRequest,
  ) {
    return this.documentsService.removeForProject(
      projectId,
      documentId,
      request.caslUser!,
    );
  }
}
