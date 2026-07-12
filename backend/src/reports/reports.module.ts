import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { ReportsController } from './reports.controller';
import { UtilisationService } from './utilisation.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [ReportsController],
  providers: [UtilisationService],
  exports: [UtilisationService],
})
export class ReportsModule {}
