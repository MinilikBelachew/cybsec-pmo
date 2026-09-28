import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { SowsService } from './sows.service';
import { SowDocumentDto } from './dto/sow.dto';

@ApiTags('SOW')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({
  path: 'sows',
  version: '1',
})
export class SowsListController {
  constructor(private readonly sowsService: SowsService) {}

  @CheckModulePermission('sow', 'view')
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [SowDocumentDto] })
  async list(
    @Request() req: RequestWithAbility,
  ): Promise<SowDocumentDto[]> {
    return this.sowsService.list(req.caslUser!);
  }
}
