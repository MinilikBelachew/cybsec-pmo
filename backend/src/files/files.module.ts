import {
  Module,
} from '@nestjs/common';
import { RelationalFilePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesService } from './files.service';
import { FilesUploadService } from './files-upload.service';
import { FileAccessService } from './file-access.service';
import { FileAccessAuthService } from './file-access-auth.service';
import { FilesAccessController } from './files-access.controller';
import fileConfig from './config/file.config';
import { FileConfig, FileDriver } from './config/file-config.type';
import { FilesLocalModule } from './infrastructure/uploader/local/files.module';
import { FilesS3Module } from './infrastructure/uploader/s3/files.module';
import { FilesS3PresignedModule } from './infrastructure/uploader/s3-presigned/files.module';
import { FilesCloudinaryModule } from './infrastructure/uploader/cloudinary/files.module';
import { PrismaModule } from '../database/prisma.module';

const infrastructurePersistenceModule = RelationalFilePersistenceModule;

const infrastructureUploaderModule =
  (fileConfig() as FileConfig).driver === FileDriver.LOCAL
    ? FilesLocalModule
    : (fileConfig() as FileConfig).driver === FileDriver.S3
      ? FilesS3Module
      : (fileConfig() as FileConfig).driver === FileDriver.S3_PRESIGNED
        ? FilesS3PresignedModule
        : FilesCloudinaryModule;

@Module({
  imports: [
    PrismaModule,
    infrastructurePersistenceModule,
    infrastructureUploaderModule,
  ],
  controllers: [FilesAccessController],
  providers: [
    FilesService,
    FilesUploadService,
    FileAccessService,
    FileAccessAuthService,
  ],
  exports: [
    FilesService,
    FilesUploadService,
    FileAccessService,
    FileAccessAuthService,
    infrastructurePersistenceModule,
    infrastructureUploaderModule,
  ],
})
export class FilesModule {}
