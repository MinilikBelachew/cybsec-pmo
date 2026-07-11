import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { WorkspaceDocumentsController } from './workspace-documents.controller';
import { WorkspaceDocumentsService } from './workspace-documents.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [WorkspaceDocumentsController],
  providers: [WorkspaceDocumentsService],
  exports: [WorkspaceDocumentsService],
})
export class WorkspaceDocumentsModule {}
