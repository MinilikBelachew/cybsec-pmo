import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard } from '../casl/casl.guard';
import { RequestWithAbility } from '../casl/casl.guard';
import { QueryGlobalSearchDto } from './dto/query-global-search.dto';
import { GlobalSearchResponseDto } from './dto/global-search-response.dto';
import { SearchService } from './search.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Search')
@Controller({
  path: 'search',
  version: '1',
})
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: GlobalSearchResponseDto })
  async search(
    @Query() query: QueryGlobalSearchDto,
    @Request() req: RequestWithAbility,
  ): Promise<GlobalSearchResponseDto> {
    if (!req.caslUser || !req.ability) {
      throw new UnauthorizedException();
    }

    return this.searchService.search(query, req.caslUser, req.ability);
  }
}
