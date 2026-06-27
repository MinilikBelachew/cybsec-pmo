import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { DEFAULT_AUDIT_SETTINGS } from '../settings/app-settings.constants';

export type AuditExportLimits = {
  excelJsonCellLimit: number;
  pdfJsonLimit: number;
};

const DEFAULT_EXPORT_LIMITS: AuditExportLimits = {
  excelJsonCellLimit: DEFAULT_AUDIT_SETTINGS.auditExportExcelJsonCellLimit,
  pdfJsonLimit: DEFAULT_AUDIT_SETTINGS.auditExportPdfJsonLimit,
};

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        email: true;
        role: { select: { id: true; code: true; label: true } };
      };
    };
  };
}>;

type FlatAuditExportRow = {
  time: string;
  actor: string;
  email: string;
  action: string;
  objectType: string;
  objectId: string;
  ipAddress: string;
  source: string;
  isExternal: string;
  breakGlass: string;
  oldValue: string;
  newValue: string;
};

@Injectable()
export class AuditExportService {
  async buildXlsx(
    rows: AuditLogWithUser[],
    limits: AuditExportLimits = DEFAULT_EXPORT_LIMITS,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cybsec PMO';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Audit Logs');
    sheet.columns = [
      { header: 'Time (UTC)', key: 'time', width: 24 },
      { header: 'Actor', key: 'actor', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Object Type', key: 'objectType', width: 18 },
      { header: 'Object ID', key: 'objectId', width: 38 },
      { header: 'IP Address', key: 'ipAddress', width: 18 },
      { header: 'Source', key: 'source', width: 12 },
      { header: 'External', key: 'isExternal', width: 10 },
      { header: 'Break-glass', key: 'breakGlass', width: 12 },
      { header: 'Old Value', key: 'oldValue', width: 48 },
      { header: 'New Value', key: 'newValue', width: 48 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', wrapText: true };

    for (const row of rows.map((entry) =>
      this.toFlatRow(entry, limits.excelJsonCellLimit),
    )) {
      const added = sheet.addRow(row);
      added.alignment = { vertical: 'top', wrapText: true };
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildPdf(
    rows: AuditLogWithUser[],
    limits: AuditExportLimits = DEFAULT_EXPORT_LIMITS,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        layout: 'landscape',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text('Audit Trail Export', { align: 'center' });
      doc
        .fontSize(9)
        .fillColor('#555555')
        .text(`Generated ${new Date().toISOString()} · ${rows.length} events`, {
          align: 'center',
        });
      doc.moveDown(1);
      doc.fillColor('#000000');

      if (rows.length === 0) {
        doc.fontSize(10).text('No audit events matched the export filters.');
        doc.end();
        return;
      }

      for (const [index, entry] of rows.entries()) {
        const flat = this.toFlatRow(entry, limits.pdfJsonLimit);

        if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
          doc.addPage();
        }

        doc
          .fontSize(10)
          .fillColor('#111111')
          .text(`${index + 1}. ${flat.action}`, { continued: false });
        doc
          .fontSize(8)
          .fillColor('#333333')
          .text(
            `${flat.time} · ${flat.actor} · ${flat.email} · ${flat.objectType} · IP ${flat.ipAddress}`,
          );
        doc.text(
          `Object ID: ${flat.objectId || '—'} · Source: ${flat.source} · External: ${flat.isExternal} · Break-glass: ${flat.breakGlass}`,
        );

        if (flat.oldValue !== '—') {
          doc.fontSize(7).fillColor('#444444').text(`Old: ${flat.oldValue}`);
        }
        if (flat.newValue !== '—') {
          doc.fontSize(7).fillColor('#444444').text(`New: ${flat.newValue}`);
        }

        doc.moveDown(0.6);
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor('#dddddd')
          .stroke();
        doc.moveDown(0.4);
        doc.fillColor('#000000');
      }

      doc.end();
    });
  }

  private toFlatRow(
    entry: AuditLogWithUser,
    jsonLimit: number,
  ): FlatAuditExportRow {
    return {
      time: entry.createdAt.toISOString(),
      actor: entry.user?.displayName ?? 'System',
      email: entry.user?.email ?? '—',
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId ?? '—',
      ipAddress: entry.ipAddress ?? '—',
      source: entry.source ?? '—',
      isExternal: entry.isExternal ? 'Yes' : 'No',
      breakGlass: entry.breakGlassAction ? 'Yes' : 'No',
      oldValue: this.stringifyJson(entry.oldValue, jsonLimit),
      newValue: this.stringifyJson(entry.newValue, jsonLimit),
    };
  }

  private stringifyJson(value: Prisma.JsonValue | null, limit: number): string {
    if (value === null || value === undefined) {
      return '—';
    }

    let serialized: string;
    if (typeof value === 'string') {
      serialized = value;
    } else {
      try {
        serialized = JSON.stringify(value);
      } catch {
        serialized = String(value);
      }
    }

    if (serialized.length <= limit) {
      return serialized;
    }

    return `${serialized.slice(0, limit)}… [truncated]`;
  }
}
