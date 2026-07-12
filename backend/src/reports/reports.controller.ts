import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { QueryUtilisationDto } from './dto/query-utilisation.dto';
import { UtilisationReportResponseDto } from './dto/utilisation-response.dto';
import { UtilisationService } from './utilisation.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Reports')
@Controller({
  path: 'reports',
  version: '1',
})
export class ReportsController {
  constructor(private readonly utilisationService: UtilisationService) {}

  @CheckAbility('read', 'Report')
  @Get('utilisation')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UtilisationReportResponseDto })
  getUtilisationReport(
    @Query() query: QueryUtilisationDto,
    @Request() request: RequestWithAbility,
  ): Promise<UtilisationReportResponseDto> {
    return this.utilisationService.getUtilisationReport(
      query,
      request.caslUser!,
    );
  }
}
