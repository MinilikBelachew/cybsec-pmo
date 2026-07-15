import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { WorkspaceDocumentsController } from './workspace-documents.controller';
import { WorkspaceDocumentsVaultController } from './workspace-documents-vault.controller';
import { WorkspaceDocumentsService } from './workspace-documents.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [
    WorkspaceDocumentsVaultController,
    WorkspaceDocumentsController,
  ],
  providers: [WorkspaceDocumentsService],
  exports: [WorkspaceDocumentsService],
})
export class WorkspaceDocumentsModule {}
