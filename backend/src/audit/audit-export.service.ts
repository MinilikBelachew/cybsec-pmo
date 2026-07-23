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
  description: string;
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
      { header: 'Description', key: 'description', width: 40 },
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
      // ── Constants ──────────────────────────────────────────────────────────
      const MARGIN = 36;
      const COLOR_HEADER_BG   = '#1e293b';
      const COLOR_HEADER_TEXT = '#ffffff';
      const COLOR_ROW_ALT     = '#f8fafc';
      const COLOR_ROW_EVEN    = '#ffffff';
      const COLOR_BORDER      = '#e2e8f0';
      const COLOR_BORDER_DARK = '#94a3b8';
      const COLOR_BODY        = '#1e293b';
      const COLOR_MUTED       = '#64748b';
      const COLOR_ACTION      = '#3b82f6';
      const COLOR_DANGER      = '#ef4444';

      const HEADER_H   = 22;
      const MIN_ROW_H  = 20;  // minimum row height
      const CELL_PAD_H = 4;   // horizontal cell padding
      const CELL_PAD_V = 6;   // top padding before text
      const FONT_SIZE  = 6.5;
      const LINE_GAP   = 2;   // extra space between text lines

      // A4 landscape: 841.89 × 595.28 pt  →  usable ≈ 770 pt wide
      const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape' });
      const USABLE_W    = doc.page.width - MARGIN * 2;
      const BOTTOM_LIMIT = doc.page.height - MARGIN - 18;

      const chunks: Buffer[] = [];
      doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Column definitions — widths sum to USABLE_W (≈ 770) ───────────────
      type ColKey = keyof FlatAuditExportRow;
      const COLS: { key: ColKey; label: string; width: number; expand?: boolean }[] = [
        { key: 'time',        label: 'Time (UTC)',   width: 100 },
        { key: 'actor',       label: 'Actor',        width: 72  },
        { key: 'action',      label: 'Action',       width: 90  },
        { key: 'description', label: 'Description',  width: 120 },
        { key: 'objectType',  label: 'Object Type',  width: 70  },
        { key: 'objectId',    label: 'Object ID',    width: 72  },
        { key: 'ipAddress',   label: 'IP Address',   width: 64  },
        { key: 'isExternal',  label: 'Ext',          width: 22  },
        { key: 'breakGlass',  label: 'BG',           width: 22  },
        // These two expand vertically to show full JSON content
        { key: 'oldValue',    label: 'Old Value',    width: 68, expand: true },
        { key: 'newValue',    label: 'New Value',    width: 68, expand: true },
      ];

      // ── Helper: measure the height the Old/New cells will need ────────────
      const measureRowHeight = (flat: FlatAuditExportRow): number => {
        let maxH = MIN_ROW_H;
        doc.fontSize(FONT_SIZE).font('Helvetica');
        for (const col of COLS) {
          if (!col.expand) continue;
          const val = flat[col.key] ?? '—';
          if (val === '—') continue;
          const textW = col.width - CELL_PAD_H * 2;
          const h = doc.heightOfString(val, { width: textW, lineGap: LINE_GAP }) + CELL_PAD_V * 2;
          if (h > maxH) maxH = h;
        }
        return maxH;
      };

      // ── Cover title ────────────────────────────────────────────────────────
      doc
        .fontSize(15).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Audit Trail Export', MARGIN, MARGIN, { align: 'center', width: USABLE_W });
      doc
        .fontSize(8).font('Helvetica').fillColor(COLOR_MUTED)
        .text(
          `Generated ${new Date().toUTCString()}   ·   ${rows.length} event${rows.length === 1 ? '' : 's'}`,
          MARGIN, doc.y + 2, { align: 'center', width: USABLE_W },
        );
      doc.moveDown(0.8);

      if (rows.length === 0) {
        doc.fontSize(10).fillColor(COLOR_MUTED)
           .text('No audit events matched the export filters.', { align: 'center' });
        doc.end();
        return;
      }

      // ── Helper: draw table header ──────────────────────────────────────────
      const drawHeader = (y: number) => {
        let x = MARGIN;
        for (const col of COLS) {
          doc.rect(x, y, col.width, HEADER_H).fillColor(COLOR_HEADER_BG).fill();
          doc.fontSize(FONT_SIZE).font('Helvetica-Bold').fillColor(COLOR_HEADER_TEXT)
             .text(col.label, x + CELL_PAD_H, y + 7, {
               width:     col.width - CELL_PAD_H * 2,
               height:    HEADER_H - 8,
               ellipsis:  true,
               lineBreak: false,
             });
          x += col.width;
        }
        doc.moveTo(MARGIN, y + HEADER_H)
           .lineTo(MARGIN + USABLE_W, y + HEADER_H)
           .strokeColor(COLOR_ACTION).lineWidth(1.5).stroke();
        doc.lineWidth(0.4);
      };

      // ── Helper: draw one data row with dynamic height ──────────────────────
      const drawRow = (flat: FlatAuditExportRow, rowIndex: number, y: number, rowH: number) => {
        // Background
        doc.rect(MARGIN, y, USABLE_W, rowH)
           .fillColor(rowIndex % 2 === 0 ? COLOR_ROW_EVEN : COLOR_ROW_ALT)
           .fill();

        // Bottom border
        doc.moveTo(MARGIN, y + rowH)
           .lineTo(MARGIN + USABLE_W, y + rowH)
           .strokeColor(COLOR_BORDER).lineWidth(0.4).stroke();

        let x = MARGIN;
        for (const col of COLS) {
          // Vertical separator (between columns)
          if (x > MARGIN) {
            doc.moveTo(x, y + 2)
               .lineTo(x, y + rowH - 2)
               .strokeColor(COLOR_BORDER).lineWidth(0.4).stroke();
          }

          const val       = flat[col.key] ?? '—';
          const isFlag    = col.key === 'isExternal' || col.key === 'breakGlass';
          const isAction  = col.key === 'action';
          const isExpand  = col.expand === true;

          const textColor = isAction
            ? COLOR_ACTION
            : isFlag && val === 'Yes' ? COLOR_DANGER
            : isFlag                  ? COLOR_MUTED
            : COLOR_BODY;

          if (isExpand && val !== '—') {
            // Wrap fully — no truncation
            doc.fontSize(FONT_SIZE).font('Helvetica').fillColor(COLOR_MUTED)
               .text(val, x + CELL_PAD_H, y + CELL_PAD_V, {
                 width:    col.width - CELL_PAD_H * 2,
                 lineGap:  LINE_GAP,
                 lineBreak: true,
               });
          } else {
            // All other columns: single line with ellipsis, vertically centred
            const textTop = y + Math.max(CELL_PAD_V, (rowH - FONT_SIZE) / 2);
            doc.fontSize(FONT_SIZE)
               .font(isAction ? 'Helvetica-Bold' : 'Helvetica')
               .fillColor(textColor)
               .text(val, x + CELL_PAD_H, textTop, {
                 width:     col.width - CELL_PAD_H * 2,
                 height:    FONT_SIZE + 2,
                 ellipsis:  true,
                 lineBreak: false,
               });
          }

          x += col.width;
        }

        // Right outer border
        doc.moveTo(MARGIN + USABLE_W, y)
           .lineTo(MARGIN + USABLE_W, y + rowH)
           .strokeColor(COLOR_BORDER).lineWidth(0.4).stroke();
      };

      // ── Left outer border for a page section ──────────────────────────────
      const drawLeftBorder = (topY: number, bottomY: number) => {
        doc.moveTo(MARGIN, topY)
           .lineTo(MARGIN, bottomY)
           .strokeColor(COLOR_BORDER_DARK).lineWidth(0.6).stroke();
      };

      // ── Render table ───────────────────────────────────────────────────────
      let currentY    = doc.y;
      let sectionTopY = currentY;
      drawHeader(currentY);
      currentY += HEADER_H;

      for (let i = 0; i < rows.length; i++) {
        // Use full JSON for PDF — no length truncation on Old/New values
        const flat  = this.toFlatRow(rows[i], Number.MAX_SAFE_INTEGER);
        const rowH  = measureRowHeight(flat);

        // Page-break check: if row won't fit, flush and start a new page
        if (currentY + rowH > BOTTOM_LIMIT) {
          drawLeftBorder(sectionTopY, currentY);
          doc.moveTo(MARGIN, currentY)
             .lineTo(MARGIN + USABLE_W, currentY)
             .strokeColor(COLOR_BORDER_DARK).lineWidth(0.6).stroke();

          doc.fontSize(6.5).fillColor(COLOR_MUTED).font('Helvetica')
             .text('Cybsec PMO · Confidential', MARGIN, currentY + 5,
               { align: 'center', width: USABLE_W });

          doc.addPage();
          currentY    = MARGIN;
          sectionTopY = currentY;
          drawHeader(currentY);
          currentY += HEADER_H;
        }

        drawRow(flat, i, currentY, rowH);
        currentY += rowH;
      }

      // Close last table section
      drawLeftBorder(sectionTopY, currentY);
      doc.moveTo(MARGIN, currentY)
         .lineTo(MARGIN + USABLE_W, currentY)
         .strokeColor(COLOR_BORDER_DARK).lineWidth(0.8).stroke();

      doc.fontSize(6.5).fillColor(COLOR_MUTED).font('Helvetica')
         .text(
           `Cybsec PMO  ·  Confidential  ·  ${rows.length} record${rows.length === 1 ? '' : 's'} exported`,
           MARGIN, currentY + 6,
           { align: 'center', width: USABLE_W },
         );

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
      description: entry.description ?? '—',
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
