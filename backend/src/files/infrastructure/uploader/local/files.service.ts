import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileRepository } from '../../persistence/file.repository';
import { AllConfigType } from '../../../../config/config.type';
import { FileType } from '../../../domain/file';
import {
  buildLocalFilePublicPath,
  isAllowedUploadFilename,
  persistLocalUpload,
} from './local-file-storage';

export type LocalFileCreateResult = {
  file: FileType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
};

@Injectable()
export class FilesLocalService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileRepository: FileRepository,
  ) {}

  async create(file: Express.Multer.File): Promise<LocalFileCreateResult> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'selectFile',
        },
      });
    }

    if (!isAllowedUploadFilename(file.originalname)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'cantUploadFileType',
        },
      });
    }

    const diskFilename = await persistLocalUpload(file);
    const apiPrefix = this.configService.getOrThrow('app.apiPrefix', {
      infer: true,
    });
    const publicPath = buildLocalFilePublicPath(apiPrefix, diskFilename);

    const stored = await this.fileRepository.create({
      path: publicPath,
    });

    return {
      file: stored,
      filename: file.originalname,
      mimeType: file.mimetype ?? 'application/octet-stream',
      sizeBytes: file.size ?? 0,
      storageKey: publicPath,
    };
  }
}
