import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HomeService } from './home.service';

@ApiTags('Home')
@Controller()
export class HomeController {
  constructor(private service: HomeService) {}

  /** Health / app info — skip global API rate limit. */
  @SkipThrottle()
  @Get()
  appInfo() {
    return this.service.appInfo();
  }
}
