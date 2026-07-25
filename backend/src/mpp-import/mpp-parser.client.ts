import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { AllConfigType } from '../config/config.type';
import { MspdiExportFileResult, MspdiExportRequestPayload } from './mspdi-export.types';
import { ParsedMppProject } from './mpp-import.types';
import { enrichParsedFromMspdiXml } from './mspdi-schedule-enricher';

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

    const parsed = payload as ParsedMppProject;
    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = [];
    }
    if (!Array.isArray(parsed.warnings)) {
      parsed.warnings = [];
    }

    // Always attempt MSPDI nested Baseline/Actual enrichment (MPXJ leaves these null).
    // Early-returns inside enricher when the buffer has no Baseline/ActualStart tags.
    try {
      const enriched = enrichParsedFromMspdiXml(parsed, buffer);
      const withBaseline = enriched.tasks.filter((t) => !!t.baselineStartDate).length;
      const withActual = enriched.tasks.filter((t) => !!t.actualStartDate).length;
      const msg =
        `MSPDI enrich: ${withBaseline}/${enriched.tasks.length} tasks with baseline` +
        `, ${withActual} with actual start` +
        (enriched.project?.baselineStartDate
          ? `; project baseline ${enriched.project.baselineStartDate}→${enriched.project.baselineFinishDate} (${enriched.project.baselineDurationDays ?? '?'}d), duration ${enriched.project.durationDays ?? '?'}`
          : '');
      this.logger.warn(msg);
      enriched.warnings = [...(enriched.warnings ?? []), msg];
      return enriched;
    } catch (error) {
      const message = `MSPDI enrich failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this.logger.error(message);
      parsed.warnings.push(message);
      return parsed;
    }
  }

  /**
   * Ask mpxj-service to write MSPDI (Microsoft Project XML).
   * Binary .mpp cannot be produced by MPXJ.
   */
  async exportMspdi(payload: MspdiExportRequestPayload): Promise<MspdiExportFileResult> {
    const baseUrl = this.configService.getOrThrow('mppImport.serviceUrl', {
      infer: true,
    });

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/export/mspdi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = `MPXJ export failed with status ${response.status}`;
      try {
        const err = (await response.json()) as { error?: string };
        if (err?.error) message = err.error;
      } catch {
        // ignore JSON parse errors
      }
      this.logger.error(message);
      throw new Error(message);
    }

    const arrayBuffer = await response.arrayBuffer();
    const disposition = response.headers.get('content-disposition') || '';
    const matched = disposition.match(/filename="?([^"]+)"?/i);
    const safeName =
      payload.project.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'schedule';

    return {
      filename: matched?.[1] || `${safeName}.xml`,
      contentType: response.headers.get('content-type') || 'application/xml',
      buffer: Buffer.from(arrayBuffer),
    };
  }
}
