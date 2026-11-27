import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { EntraConnectionService } from '../auth/entra-connection.service';
import {
  EntraConnectionResponseDto,
  EntraConnectionTestResultDto,
  UpdateEntraConnectionDto,
} from '../auth/dto/entra-connection.dto';
import { MailConnectionService } from '../mailer/mail-connection.service';
import {
  MailConnectionResponseDto,
  MailConnectionTestResultDto,
  TestMailConnectionDto,
  UpdateMailConnectionDto,
} from '../mailer/dto/mail-connection.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Settings')
@Controller({
  path: 'settings',
  version: '1',
})
export class ConnectionSettingsController {
  constructor(
    private readonly entraConnectionService: EntraConnectionService,
    private readonly mailConnectionService: MailConnectionService,
  ) {}

  @CheckAbility('manage', 'Settings')
  @Get('entra')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EntraConnectionResponseDto })
  getEntraConnection(): Promise<EntraConnectionResponseDto> {
    return this.entraConnectionService.getConnectionView();
  }

  @CheckAbility('manage', 'Settings')
  @Put('entra')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EntraConnectionResponseDto })
  updateEntraConnection(
    @Body() dto: UpdateEntraConnectionDto,
    @Request() request: RequestWithAbility,
  ): Promise<EntraConnectionResponseDto> {
    return this.entraConnectionService.updateConnection(
      dto,
      request.user?.id ?? null,
    );
  }

  @CheckAbility('manage', 'Settings')
  @Post('entra/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EntraConnectionTestResultDto })
  testEntraConnection(
    @Body() dto: UpdateEntraConnectionDto,
    @Request() request: RequestWithAbility,
  ): Promise<EntraConnectionTestResultDto> {
    return this.entraConnectionService.testConnection(
      request.user?.id ?? null,
      dto,
    );
  }

  @CheckAbility('manage', 'Settings')
  @Get('mail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MailConnectionResponseDto })
  getMailConnection(): Promise<MailConnectionResponseDto> {
    return this.mailConnectionService.getConnectionView();
  }

  @CheckAbility('manage', 'Settings')
  @Put('mail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MailConnectionResponseDto })
  updateMailConnection(
    @Body() dto: UpdateMailConnectionDto,
    @Request() request: RequestWithAbility,
  ): Promise<MailConnectionResponseDto> {
    return this.mailConnectionService.updateConnection(
      dto,
      request.user?.id ?? null,
    );
  }

  @CheckAbility('manage', 'Settings')
  @Post('mail/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MailConnectionTestResultDto })
  testMailConnection(
    @Body() dto: TestMailConnectionDto,
    @Request() request: RequestWithAbility,
  ): Promise<MailConnectionTestResultDto> {
    return this.mailConnectionService.testConnection(
      request.user?.id ?? null,
      dto,
    );
  }
}
