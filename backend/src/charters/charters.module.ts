import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../database/prisma.module';
import { ChartersController } from './charters.controller';
import { ChartersService } from './charters.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [ChartersController],
  providers: [ChartersService],
  exports: [ChartersService],
})
export class ChartersModule {}
