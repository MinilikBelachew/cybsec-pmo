import {
  Controller,
  Get,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { FileAccessAuthService } from './file-access-auth.service';
import { FileAccessService } from './file-access.service';
import {
  FileAccessQueryDto,
  FileAccessResponseDto,
} from './dto/file-access.dto';

type AuthRequest = RequestWithAbility;

@ApiTags('Files')
@Controller({
  path: 'files',
  version: '1',
})
export class FilesAccessController {
  constructor(
    private readonly fileAccessService: FileAccessService,
    private readonly fileAccessAuthService: FileAccessAuthService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CaslGuard)
  @UseInterceptors(CaslAbilityInterceptor)
  @Get('access')
  @ApiOkResponse({ type: FileAccessResponseDto })
  async getAccessUrl(
    @Query() query: FileAccessQueryDto,
    @Request() request: AuthRequest,
  ): Promise<FileAccessResponseDto> {
    await this.fileAccessAuthService.assertCanAccessStorageKey(
      query.storageKey,
      request.caslUser!,
      request.ability!,
    );

    return this.fileAccessService.getSignedDownloadUrl(
      query.storageKey,
      query.filename,
    );
  }

  @Get('content')
  @ApiExcludeEndpoint()
  async streamLocalContent(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('filename') filename: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    this.fileAccessService.verifyLocalContentToken(key, exp, sig);
    await this.fileAccessService.streamLocalFile(key, filename, response);
  }
}
