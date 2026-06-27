import { Controller, Get, HttpCode, HttpStatus, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CurrenciesService, CurrencyDto } from './currencies.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Currencies')
@Controller({
  path: 'currencies',
  version: '1',
})
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [Object], description: 'List of supported currencies' })
  findAll(): Promise<CurrencyDto[]> {
    return this.currenciesService.findAll();
  }
}
