import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import fxConfig from './config/fx.config';
import { FxService } from './fx.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(fxConfig), PrismaModule],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
