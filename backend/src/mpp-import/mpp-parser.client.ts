import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { AllConfigType } from '../config/config.type';
import { ParsedMppProject } from './mpp-import.types';

@Injectable()
export class MppParserClient {
  private readonly logger = new Logger(MppParserClient.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async parseFile(filePath: string, fileName: string): Promise<ParsedMppProject> {
    const baseUrl = this.configService.getOrThrow('mppImport.serviceUrl', {
      infer: true,
    });
    const buffer = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), fileName);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/parse`, {
      method: 'POST',
      body: form,
    });

    const payload = (await response.json()) as ParsedMppProject | { error?: string };

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'error' in payload && payload.error
          ? payload.error
          : `MPXJ parser failed with status ${response.status}`;
      this.logger.error(message);
      throw new Error(message);
    }

    return payload as ParsedMppProject;
  }
}
