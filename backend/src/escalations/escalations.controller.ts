import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CheckAnyModulePermission } from '../casl/decorators/check-any-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { EscalationsService } from './escalations.service';
import {
  AddEscalationCommunicationDto,
  CloseEscalationDto,
  CreateEscalationDto,
  EscalationDto,
} from './dto/escalation.dto';

@ApiTags('Escalations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ path: 'escalations', version: '1' })
export class EscalationsController {
  constructor(private readonly escalationsService: EscalationsService) {}

  @CheckAbility('read', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'risks', action: 'view' },
    { module: 'projects', action: 'view' },
  )
  @Get()
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiOkResponse({ type: [EscalationDto] })
  list(
    @Request() request: RequestWithAbility,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ): Promise<EscalationDto[]> {
    return this.escalationsService.list(request.caslUser!, {
      customerId,
      status,
      severity,
    });
  }

  @CheckAbility('update', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'risks', action: 'edit' },
  )
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: EscalationDto })
  create(
    @Body() dto: CreateEscalationDto,
    @Request() request: RequestWithAbility,
  ): Promise<EscalationDto> {
    return this.escalationsService.create(
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'risks', action: 'edit' },
  )
  @Post(':id/communication')
  @ApiOkResponse({ type: EscalationDto })
  addCommunication(
    @Param('id') id: string,
    @Body() dto: AddEscalationCommunicationDto,
    @Request() request: RequestWithAbility,
  ): Promise<EscalationDto> {
    return this.escalationsService.addCommunication(
      id,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Project')
  @CheckAnyModulePermission(
    { module: 'issues', action: 'edit' },
    { module: 'risks', action: 'edit' },
  )
  @Patch(':id/close')
  @ApiOkResponse({ type: EscalationDto })
  close(
    @Param('id') id: string,
    @Body() dto: CloseEscalationDto,
    @Request() request: RequestWithAbility,
  ): Promise<EscalationDto> {
    return this.escalationsService.close(
      id,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }
}
