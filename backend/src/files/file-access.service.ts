import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { AllConfigType } from '../config/config.type';
import { FileDriver } from './config/file-config.type';
import {
  LOCAL_FILES_DIR,
  buildLocalFilePublicPath,
} from './infrastructure/uploader/local/local-file-storage';

const DEFAULT_TTL_SECONDS = 900;

export type SignedFileAccess = {
  url: string;
  expiresAt: string;
};

@Injectable()
export class FileAccessService {
  private s3Client: S3Client | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async getSignedDownloadUrl(
    storageKey: string,
    filename?: string,
  ): Promise<SignedFileAccess> {
    const driver = this.configService.get('file.driver', { infer: true });

    if (driver === FileDriver.S3 || driver === FileDriver.S3_PRESIGNED) {
      return await this.signS3Url(storageKey, filename);
    }

    if (driver === FileDriver.CLOUDINARY) {
      return this.signCloudinaryUrl(storageKey);
    }

    return this.signLocalUrl(storageKey, filename);
  }

  verifyLocalContentToken(key: string, exp: string, sig: string): void {
    const expiresAt = Number(exp);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileLinkExpired' },
      });
    }

    const expected = this.buildLocalContentSignature(key, expiresAt);
    const provided = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (
      provided.length !== expectedBuf.length ||
      !timingSafeEqual(provided, expectedBuf)
    ) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileLinkInvalid' },
      });
    }
  }

  async streamLocalFile(
    diskFilename: string,
    filename: string | undefined,
    response: Response,
  ): Promise<void> {
    if (!diskFilename || diskFilename.includes('..') || diskFilename.includes('/')) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileLinkInvalid' },
      });
    }

    const absolutePath = path.join(LOCAL_FILES_DIR, diskFilename);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { file: 'fileNotFound' },
      });
    }

    if (filename) {
      response.setHeader(
        'Content-Disposition',
        `inline; filename="${filename.replace(/"/g, '')}"`,
      );
    }

    response.sendFile(diskFilename, { root: LOCAL_FILES_DIR });
  }

  private async signS3Url(storageKey: string, filename?: string): Promise<SignedFileAccess> {
    const key = this.extractS3ObjectKey(storageKey);
    const client = this.getS3Client();
    const bucket = this.configService.getOrThrow('file.awsDefaultS3Bucket', {
      infer: true,
    });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `inline; filename="${filename.replace(/"/g, '')}"`
        : undefined,
    });

    return await this.wrapSignedUrl(
      getSignedUrl(client, command, { expiresIn: DEFAULT_TTL_SECONDS }),
    );
  }

  private signCloudinaryUrl(storageKey: string): SignedFileAccess {
    this.ensureCloudinaryConfigured();
    const { publicId, resourceType } = this.parseCloudinaryPublicId(storageKey);
    const expiresAtUnix = Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS;

    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      secure: true,
      sign_url: true,
      expires_at: expiresAtUnix,
    });

    return {
      url,
      expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
    };
  }

  private signLocalUrl(storageKey: string, filename?: string): SignedFileAccess {
    const diskFilename = this.extractLocalDiskFilename(storageKey);
    const expiresAtUnix = Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS;
    const signature = this.buildLocalContentSignature(diskFilename, expiresAtUnix);
    const apiPrefix = this.configService.getOrThrow('app.apiPrefix', { infer: true });
    const backendDomain =
      process.env.BACKEND_DOMAIN?.replace(/\/$/, '') ?? 'http://localhost:6001';

    const params = new URLSearchParams({
      key: diskFilename,
      exp: String(expiresAtUnix),
      sig: signature,
    });
    if (filename) {
      params.set('filename', filename);
    }

    return {
      url: `${backendDomain}/${apiPrefix}/v1/files/content?${params.toString()}`,
      expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
    };
  }

  private buildLocalContentSignature(diskFilename: string, expiresAtUnix: number): string {
    const secret = this.configService.getOrThrow('auth.secret', { infer: true });
    return createHmac('sha256', secret)
      .update(`${diskFilename}:${expiresAtUnix}`)
      .digest('hex');
  }

  private extractLocalDiskFilename(storageKey: string): string {
    const apiPrefix = this.configService.getOrThrow('app.apiPrefix', { infer: true });
    const publicPrefix = buildLocalFilePublicPath(apiPrefix, '');
    const normalizedPrefix = publicPrefix.replace(/\/$/, '');

    if (storageKey.startsWith(normalizedPrefix)) {
      return storageKey.slice(normalizedPrefix.length + 1);
    }

    if (storageKey.startsWith('/')) {
      const segments = storageKey.split('/').filter(Boolean);
      return segments[segments.length - 1] ?? storageKey;
    }

    return storageKey;
  }

  private extractS3ObjectKey(storageKey: string): string {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      try {
        const url = new URL(storageKey);
        return url.pathname.replace(/^\//, '');
      } catch {
        return storageKey;
      }
    }
    return storageKey;
  }

  private parseCloudinaryPublicId(storageKey: string): {
    publicId: string;
    resourceType: string;
  } {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      const url = new URL(storageKey);
      const segments = url.pathname.split('/').filter(Boolean);
      const uploadIndex = segments.indexOf('upload');
      if (uploadIndex >= 0) {
        const resourceType = segments[uploadIndex - 1] ?? 'image';
        let rest = segments.slice(uploadIndex + 1);
        if (rest[0]?.startsWith('v') && /^\d+$/.test(rest[0].slice(1))) {
          rest = rest.slice(1);
        }
        const withExtension = rest.join('/');
        return {
          publicId: withExtension.replace(/\.[^/.]+$/, ''),
          resourceType,
        };
      }
    }

    return {
      publicId: storageKey.replace(/\.[^/.]+$/, ''),
      resourceType: 'auto',
    };
  }

  private ensureCloudinaryConfigured(): void {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow('file.cloudinaryCloudName', {
        infer: true,
      }),
      api_key: this.configService.getOrThrow('file.cloudinaryApiKey', { infer: true }),
      api_secret: this.configService.getOrThrow('file.cloudinaryApiSecret', {
        infer: true,
      }),
      secure: true,
    });
  }

  private getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.configService.get('file.awsS3Region', { infer: true }),
        endpoint:
          this.configService.get('file.awsS3Endpoint', { infer: true }) || undefined,
        credentials: {
          accessKeyId: this.configService.getOrThrow('file.accessKeyId', {
            infer: true,
          }),
          secretAccessKey: this.configService.getOrThrow('file.secretAccessKey', {
            infer: true,
          }),
        },
      });
    }
    return this.s3Client;
  }

  private async wrapSignedUrl(
    urlPromise: Promise<string>,
  ): Promise<SignedFileAccess> {
    const url = await urlPromise;
    return {
      url,
      expiresAt: new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000).toISOString(),
    };
  }
}
