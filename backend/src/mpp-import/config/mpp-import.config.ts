import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { MppImportConfig } from './mpp-import-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  MPXJ_SERVICE_URL: string;

  @IsString()
  @IsOptional()
  MPP_IMPORT_STORAGE_DIR: string;

  @IsInt()
  @Min(1)
  @Max(104857600)
  @IsOptional()
  MPP_IMPORT_MAX_FILE_SIZE_BYTES: number;
}

export default registerAs<MppImportConfig>('mppImport', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    serviceUrl: process.env.MPXJ_SERVICE_URL ?? 'http://mpxj-service:8080',
    storageDir: process.env.MPP_IMPORT_STORAGE_DIR ?? '/tmp/mpp-imports',
    maxFileSizeBytes: Number(process.env.MPP_IMPORT_MAX_FILE_SIZE_BYTES ?? 52428800),
  };
});
