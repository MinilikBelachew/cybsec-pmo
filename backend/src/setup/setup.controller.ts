import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SetupService } from './setup.service';
import { SetupTokenGuard } from './guards/setup-token.guard';
import {
  SaveSetupEntraDto,
  SetupConfigResponseDto,
  SetupStatusResponseDto,
  UnlockSetupDto,
  UnlockSetupResponseDto,
} from './dto/setup.dto';
import {
  EntraConnectionTestResultDto,
  UpdateEntraConnectionDto,
} from '../auth/dto/entra-connection.dto';
import {
  MailConnectionResponseDto,
  MailConnectionTestResultDto,
  TestMailConnectionDto,
  UpdateMailConnectionDto,
} from '../mailer/dto/mail-connection.dto';
import {
  KekaConnectionResponseDto,
  KekaConnectionTestResultDto,
  UpdateKekaConnectionDto,
} from '../integrations/keka/dto/keka-connection.dto';

@ApiTags('Setup')
@Controller({
  path: 'setup',
  version: '1',
})
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SetupStatusResponseDto })
  getStatus(): Promise<SetupStatusResponseDto> {
    return this.setupService.getStatus();
  }

  @Post('unlock')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UnlockSetupResponseDto })
  unlock(@Body() dto: UnlockSetupDto): Promise<UnlockSetupResponseDto> {
    return this.setupService.unlock(dto.setupKey);
  }

  @UseGuards(SetupTokenGuard)
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SetupConfigResponseDto })
  getConfig(): Promise<SetupConfigResponseDto> {
    return this.setupService.getConfig();
  }

  @UseGuards(SetupTokenGuard)
  @Put('entra')
  @HttpCode(HttpStatus.OK)
  saveEntra(@Body() dto: SaveSetupEntraDto) {
    return this.setupService.saveEntraAndSuperAdmin(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Post('entra/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EntraConnectionTestResultDto })
  testEntra(
    @Body() dto?: UpdateEntraConnectionDto,
  ): Promise<EntraConnectionTestResultDto> {
    return this.setupService.testEntra(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Put('mail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MailConnectionResponseDto })
  saveMail(
    @Body() dto: UpdateMailConnectionDto,
  ): Promise<MailConnectionResponseDto> {
    return this.setupService.saveMail(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Post('mail/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MailConnectionTestResultDto })
  testMail(
    @Body() dto: TestMailConnectionDto,
  ): Promise<MailConnectionTestResultDto> {
    return this.setupService.testMail(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Put('keka')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionResponseDto })
  saveKeka(
    @Body() dto: UpdateKekaConnectionDto,
  ): Promise<KekaConnectionResponseDto> {
    return this.setupService.saveKeka(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Post('keka/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KekaConnectionTestResultDto })
  testKeka(
    @Body() dto?: UpdateKekaConnectionDto,
  ): Promise<KekaConnectionTestResultDto> {
    return this.setupService.testKeka(dto);
  }

  @UseGuards(SetupTokenGuard)
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SetupStatusResponseDto })
  completeSetup(): Promise<SetupStatusResponseDto> {
    return this.setupService.completeSetup();
  }
}
