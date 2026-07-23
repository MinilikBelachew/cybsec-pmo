import { promises as fs } from 'fs';
import * as path from 'path';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';

export const LOCAL_FILES_DIR = './files';

const ALLOWED_EXTENSION =
  /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|csv|txt|mpp|mpx|xml)$/i;

export function isAllowedUploadFilename(filename: string): boolean {
  return ALLOWED_EXTENSION.test(filename);
}

export function buildLocalFilePublicPath(apiPrefix: string, diskFilename: string): string {
  return `/${apiPrefix}/v1/files/${diskFilename}`;
}

function extensionFromFilename(filename: string): string {
  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : '';
}

export async function persistLocalUpload(file: Express.Multer.File): Promise<string> {
  await fs.mkdir(LOCAL_FILES_DIR, { recursive: true });

  if (file.filename) {
    return file.filename;
  }

  if (file.path) {
    const basename = path.basename(file.path);
    if (basename && basename !== 'undefined') {
      return basename;
    }
  }

  const diskFilename = `${randomStringGenerator()}${extensionFromFilename(file.originalname)}`;
  const targetPath = path.join(LOCAL_FILES_DIR, diskFilename);

  if (file.buffer?.length) {
    await fs.writeFile(targetPath, file.buffer);
    return diskFilename;
  }

  throw new Error('Uploaded file has no disk path or buffer');
}
