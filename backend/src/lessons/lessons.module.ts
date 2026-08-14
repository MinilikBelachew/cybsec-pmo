import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
