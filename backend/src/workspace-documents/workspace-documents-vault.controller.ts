import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WorkspaceDocumentsService } from './workspace-documents.service';
import { QueryPortfolioWorkspaceDocumentDto } from './dto/query-portfolio-workspace-document.dto';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { infinityPagination } from '../utils/infinity-pagination';

type AuthRequest = RequestWithAbility;

@ApiTags('Document Vault')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'documents',
  version: '1',
})
export class WorkspaceDocumentsVaultController {
  constructor(private readonly documentsService: WorkspaceDocumentsService) {}

  @CheckAbility('read', 'Document')
  @Get('stats')
  stats(@Request() request: AuthRequest) {
    return this.documentsService.getVaultStats(request.caslUser!);
  }

  @CheckAbility('read', 'Document')
  @Get()
  async list(
    @Query() query: QueryPortfolioWorkspaceDocumentDto,
    @Request() request: AuthRequest,
  ) {
    const page = query.page ?? 1;
    let limit = query.limit ?? 50;
    if (limit > 100) {
      limit = 100;
    }

    const [documents, total] = await Promise.all([
      this.documentsService.findManyWithPagination(
        { ...query, page, limit },
        request.caslUser!,
      ),
      this.documentsService.countMany(
        { ...query, page, limit },
        request.caslUser!,
      ),
    ]);

    return {
      ...infinityPagination(documents, { page, limit }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }
}
