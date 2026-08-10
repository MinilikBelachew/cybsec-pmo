import { mkdirSync } from 'fs';
import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { extname } from 'path';
import { PrismaModule } from '../database/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AllConfigType } from '../config/config.type';
import { ImportsModule } from '../imports/imports.module';
import { MspdiExportBuilder } from './mspdi-export.builder';
import { MppImportController } from './mpp-import.controller';
import { MppImportService } from './mpp-import.service';
import { MppParserClient } from './mpp-parser.client';
import { MppImportMapper } from './mpp-import.mapper';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    forwardRef(() => ImportsModule),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const storageDir = configService.getOrThrow('mppImport.storageDir', {
          infer: true,
        });
        mkdirSync(storageDir, { recursive: true });

        return {
          storage: diskStorage({
            destination: storageDir,
            filename: (_request, file, callback) => {
              const extension = extname(file.originalname).toLowerCase();
              callback(null, `${randomStringGenerator()}${extension}`);
            },
          }),
          limits: {
            fileSize: configService.getOrThrow('mppImport.maxFileSizeBytes', {
              infer: true,
            }),
          },
        };
      },
    }),
  ],
  controllers: [MppImportController],
  providers: [
    MppImportService,
    MppParserClient,
    MppImportMapper,
    MspdiExportBuilder,
  ],
  exports: [MppImportService],
})
export class MppImportModule {}
