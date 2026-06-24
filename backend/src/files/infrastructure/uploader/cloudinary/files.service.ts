import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileRepository } from '../../persistence/file.repository';
import { FileType } from '../../../domain/file';

@Injectable()
export class FilesCloudinaryService {
  constructor(private readonly fileRepository: FileRepository) {}

  async create(file: any): Promise<{
    file: FileType;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'selectFile',
        },
      });
    }

    const stored = await this.fileRepository.create({
      path: file.path,
    });

    return {
      file: stored,
      filename: file.originalname ?? 'upload',
      mimeType: file.mimetype ?? 'application/octet-stream',
      sizeBytes: file.size ?? 0,
      storageKey: file.path ?? stored.path,
    };
  }
}
