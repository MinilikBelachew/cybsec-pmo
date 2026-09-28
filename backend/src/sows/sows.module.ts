import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../database/prisma.module';
import { FilesModule } from '../files/files.module';
import { SowsController } from './sows.controller';
import { SowsListController } from './sows-list.controller';
import { SowsService } from './sows.service';

@Module({
  // SowCrmWritebackService comes from global IntegrationsModule (AppModule).
  imports: [PrismaModule, CaslModule, FilesModule],
  controllers: [SowsController, SowsListController],
  providers: [SowsService],
  exports: [SowsService],
})
export class SowsModule {}
