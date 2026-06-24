import { Injectable, UnprocessableEntityException, HttpStatus } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FileDriver } from './config/file-config.type';
import { AllConfigType } from '../config/config.type';
import { FilesCloudinaryService } from './infrastructure/uploader/cloudinary/files.service';
import { FilesLocalService } from './infrastructure/uploader/local/files.service';
import { FilesS3Service } from './infrastructure/uploader/s3/files.service';
import { FilesS3PresignedService } from './infrastructure/uploader/s3-presigned/files.service';

export type UploadedFileResult = {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class FilesUploadService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async upload(file: Express.Multer.File): Promise<UploadedFileResult> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'selectFile' },
      });
    }

    const driver = this.configService.get('file.driver', { infer: true });

    if (driver === FileDriver.CLOUDINARY) {
      const service = this.moduleRef.get(FilesCloudinaryService, { strict: false });
      const result = await service.create(file);
      return {
        storageKey: result.storageKey || result.file.path,
        filename: result.filename || file.originalname,
        mimeType: result.mimeType || file.mimetype,
        sizeBytes: result.sizeBytes ?? file.size,
      };
    }

    if (driver === FileDriver.LOCAL) {
      const service = this.moduleRef.get(FilesLocalService, { strict: false });
      const result = await service.create(file);
      return {
        storageKey: result.storageKey,
        filename: result.filename,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      };
    }

    if (driver === FileDriver.S3) {
      const service = this.moduleRef.get(FilesS3Service, { strict: false });
      const result = await service.create(file as Parameters<FilesS3Service['create']>[0]);
      return {
        storageKey: result.file.path,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    if (driver === FileDriver.S3_PRESIGNED) {
      const service = this.moduleRef.get(FilesS3PresignedService, { strict: false });
      const result = await service.create(
        file as unknown as Parameters<FilesS3PresignedService['create']>[0],
      );
      return {
        storageKey: result.file.path,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { file: 'unsupportedFileDriver' },
    });
  }
}
