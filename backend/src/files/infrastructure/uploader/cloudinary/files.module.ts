import {
  HttpStatus,
  Module,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FilesCloudinaryController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

import { FilesCloudinaryService } from './files.service';
import { RelationalFilePersistenceModule } from '../../persistence/relational/relational-persistence.module';
import { AllConfigType } from '../../../../config/config.type';

const infrastructurePersistenceModule = RelationalFilePersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        cloudinary.config({
          cloud_name: configService.get('file.cloudinaryCloudName', {
            infer: true,
          }),
          api_key: configService.get('file.cloudinaryApiKey', { infer: true }),
          api_secret: configService.get('file.cloudinaryApiSecret', {
            infer: true,
          }),
          secure: true,
        });

        const storage = new CloudinaryStorage({
          cloudinary: cloudinary,
          params: async (_req: any, file: any) => ({
            folder: 'cybsec-pmo',
            resource_type: 'auto',
            public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`,
          }),
        } as any);

        return {
          fileFilter: (request, file, callback) => {
            // Allow images, documents, and audio
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|csv|txt|m4a|mp3|wav|ogg|amr|aac)$/i)) {
              return callback(
                new UnprocessableEntityException({
                  status: HttpStatus.UNPROCESSABLE_ENTITY,
                  errors: {
                    file: `cantUploadFileType`,
                  },
                }),
                false,
              );
            }

            callback(null, true);
          },
          storage: storage,
          limits: {
            fileSize: configService.get('file.maxFileSize', { infer: true }),
          },
        };
      },
    }),
  ],
  controllers: [FilesCloudinaryController],
  providers: [ConfigModule, ConfigService, FilesCloudinaryService],
  exports: [FilesCloudinaryService],
})
export class FilesCloudinaryModule {}
