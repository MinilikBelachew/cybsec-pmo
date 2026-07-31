import PDFDocument from 'pdfkit';
import {
  BrandProfile,
  INTERNAL_WATERMARK,
  ReportDocType,
  TYPOGRAPHY,
  docTypeLabel,
  resolvePdfFonts,
} from './cybersec-format.constants';

const PAGE_MARGIN = 48;
const LETTERHEAD_HEIGHT = 64;
const LOGO_MAX_WIDTH = 110;
const LOGO_MAX_HEIGHT = 36;
const LOGO_TEXT_GAP = 10;
const CONTENT_TOP = 96;
const CONTENT_BOTTOM = 56;
const CELL_PADDING = 4;

export type TableCell = {
  text: string;
  color?: string;
  bold?: boolean;
};

export type TableColumn = {
  header: string;
  /** Relative weight; converted to points across the content width. */
  width: number;
  align?: 'left' | 'right' | 'center';
};

function toCell(value: string | TableCell): TableCell {
  return typeof value === 'string' ? { text: value } : value;
}

/** pdfkit exposes openImage at runtime but omits it from its type definitions. */
type ImageReader = {
  openImage(src: Buffer | string): { width: number; height: number };
};

type PlacedLogo = { src: Buffer | string; width: number; height: number };

/**
 * Scales the logo into the letterhead box up front. Measuring means the
 * company name sits right beside the artwork instead of after a fixed box,
 * which otherwise leaves a wide gap for tall or square logos.
 */
function measureLogo(
  doc: PDFKit.PDFDocument,
  src: Buffer | string | null,
): PlacedLogo | null {
  if (!src) return null;
  try {
    const image = (doc as unknown as ImageReader).openImage(src);
    const scale = Math.min(
      LOGO_MAX_WIDTH / image.width,
      LOGO_MAX_HEIGHT / image.height,
    );
    return {
      src,
      width: image.width * scale,
      height: image.height * scale,
    };
  } catch {
    return null;
  }
}

/**
 * Renders the approved CyberSec page furniture: a letterhead on every page,
 * "Page X of Y" with the document reference in the footer, tables whose
 * headings repeat across page breaks, and the internal-only watermark.
 */
export class ApprovedPdfWriter {
  readonly doc: PDFKit.PDFDocument;
  private readonly fonts = resolvePdfFonts();
  private readonly chunks: Buffer[] = [];
  private readonly done: Promise<Buffer>;
  private readonly logo: PlacedLogo | null;

  constructor(
    private readonly brand: BrandProfile,
    private readonly options: {
      docType: ReportDocType;
      subtitle: string;
      documentRef: string;
      watermark?: boolean;
    },
  ) {
    this.doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: {
        top: CONTENT_TOP,
        bottom: CONTENT_BOTTOM,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
    });

    if (this.fonts.embedded) {
      this.doc.registerFont('body', this.fonts.regular);
      this.doc.registerFont('bodyBold', this.fonts.bold);
    }

    this.done = new Promise<Buffer>((resolve, reject) => {
      this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });

    this.logo = measureLogo(
      this.doc,
      this.brand.logoData ?? this.brand.logoPath,
    );

    this.doc.on('pageAdded', () => this.drawLetterhead());
    this.drawLetterhead();
  }

  private regular() {
    return this.fonts.embedded ? 'body' : this.fonts.regular;
  }

  private bold() {
    return this.fonts.embedded ? 'bodyBold' : this.fonts.bold;
  }

  private get contentWidth() {
    return this.doc.page.width - PAGE_MARGIN * 2;
  }

  private get contentBottom() {
    return this.doc.page.height - CONTENT_BOTTOM;
  }

  private drawLetterhead() {
    const doc = this.doc;
    const restoreY = doc.y;

    doc.rect(0, 0, doc.page.width, LETTERHEAD_HEIGHT).fill(this.brand.primaryColor);

    let textLeft = PAGE_MARGIN;
    if (this.logo) {
      const { src, width, height } = this.logo;
      try {
        doc.image(src, PAGE_MARGIN, (LETTERHEAD_HEIGHT - height) / 2, {
          width,
          height,
        });
        textLeft = PAGE_MARGIN + width + LOGO_TEXT_GAP;
      } catch {
        // A missing or unreadable logo must never block the export.
      }
    }

    doc
      .font(this.bold())
      .fillColor('#FFFFFF')
      .fontSize(TYPOGRAPHY.sectionHeading)
      .text(this.brand.companyName, textLeft, 18, { lineBreak: false });
    doc
      .font(this.regular())
      .fontSize(TYPOGRAPHY.footer)
      .text(this.brand.documentOwner, textLeft, 36, { lineBreak: false });

    doc
      .font(this.bold())
      .fontSize(TYPOGRAPHY.body)
      .text(docTypeLabel(this.options.docType), PAGE_MARGIN, 18, {
        align: 'right',
        width: this.contentWidth,
        lineBreak: false,
      });
    doc
      .font(this.regular())
      .fontSize(TYPOGRAPHY.footer)
      .text(this.options.subtitle, PAGE_MARGIN, 36, {
        align: 'right',
        width: this.contentWidth,
        lineBreak: false,
      });

    doc
      .rect(0, LETTERHEAD_HEIGHT, doc.page.width, 3)
      .fill(this.brand.accentColor);

    doc.fillColor('#000000').font(this.regular()).fontSize(TYPOGRAPHY.body);
    doc.y = restoreY < CONTENT_TOP ? CONTENT_TOP : restoreY;
  }

  title(text: string, meta: string[] = []) {
    const doc = this.doc;
    doc.y = CONTENT_TOP;
    doc
      .font(this.bold())
      .fontSize(TYPOGRAPHY.title)
      .fillColor(this.brand.primaryColor)
      .text(text, PAGE_MARGIN, doc.y, { width: this.contentWidth });
    if (meta.length) {
      doc.moveDown(0.25);
      doc
        .font(this.regular())
        .fontSize(TYPOGRAPHY.footer)
        .fillColor(this.brand.mutedColor)
        .text(meta.join('   |   '), { width: this.contentWidth });
    }
    doc.fillColor('#000000').font(this.regular()).fontSize(TYPOGRAPHY.body);
    doc.moveDown(0.7);
  }

  section(text: string) {
    const doc = this.doc;
    this.ensureSpace(46);
    doc.moveDown(0.5);
    doc
      .font(this.bold())
      .fontSize(TYPOGRAPHY.sectionHeading)
      .fillColor(this.brand.primaryColor)
      .text(text, PAGE_MARGIN, doc.y, { width: this.contentWidth });
    const ruleY = doc.y + 2;
    doc
      .lineWidth(0.75)
      .strokeColor(this.brand.accentColor)
      .moveTo(PAGE_MARGIN, ruleY)
      .lineTo(doc.page.width - PAGE_MARGIN, ruleY)
      .stroke();
    doc.y = ruleY + 6;
    doc.fillColor('#000000').font(this.regular()).fontSize(TYPOGRAPHY.body);
  }

  /** A section with no content still prints its heading plus this single line. */
  nothingToReport(message: string) {
    this.paragraph(message, { color: this.brand.mutedColor });
  }

  paragraph(
    text: string,
    options: { bold?: boolean; color?: string; indent?: number } = {},
  ) {
    const doc = this.doc;
    this.ensureSpace(24);
    const indent = options.indent ?? 0;
    doc
      .font(options.bold ? this.bold() : this.regular())
      .fontSize(TYPOGRAPHY.body)
      .fillColor(options.color ?? '#000000')
      .text(text, PAGE_MARGIN + indent, doc.y, {
        width: this.contentWidth - indent,
      });
    doc.fillColor('#000000');
    doc.moveDown(0.3);
  }

  bulletList(items: Array<string | { text: string; bold?: boolean }>) {
    for (const item of items) {
      const entry = typeof item === 'string' ? { text: item } : item;
      this.paragraph(`\u2022  ${entry.text}`, {
        bold: entry.bold,
        indent: 10,
      });
    }
  }

  /**
   * Document control block: three label/value pairs per row, boxed.
   * Version rises automatically on every reissue, so it is always present.
   */
  controlBlock(entries: Array<[string, string]>) {
    const doc = this.doc;
    const perRow = 3;
    const cellWidth = this.contentWidth / perRow;

    for (let index = 0; index < entries.length; index += perRow) {
      const row = entries.slice(index, index + perRow);
      const heights = row.map(([label, value]) => {
        doc.font(this.regular()).fontSize(TYPOGRAPHY.tableBody);
        return (
          doc.heightOfString(value || '-', {
            width: cellWidth - CELL_PADDING * 2,
          }) + 20
        );
      });
      const rowHeight = Math.max(26, ...heights);
      this.ensureSpace(rowHeight);
      const top = doc.y;

      row.forEach(([label, value], column) => {
        const x = PAGE_MARGIN + column * cellWidth;
        doc
          .lineWidth(0.5)
          .strokeColor(this.brand.lineColor)
          .rect(x, top, cellWidth, rowHeight)
          .stroke();
        doc
          .font(this.bold())
          .fontSize(7)
          .fillColor(this.brand.mutedColor)
          .text(label.toUpperCase(), x + CELL_PADDING, top + CELL_PADDING, {
            width: cellWidth - CELL_PADDING * 2,
            lineBreak: false,
          });
        doc
          .font(this.regular())
          .fontSize(TYPOGRAPHY.tableBody)
          .fillColor('#000000')
          .text(value || '-', x + CELL_PADDING, top + CELL_PADDING + 10, {
            width: cellWidth - CELL_PADDING * 2,
          });
      });

      doc.y = top + rowHeight;
    }
    doc.fillColor('#000000');
    doc.moveDown(0.5);
  }

  table(columns: TableColumn[], rows: Array<Array<string | TableCell>>) {
    const doc = this.doc;
    const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map(
      (column) => (column.width / totalWeight) * this.contentWidth,
    );

    this.ensureSpace(60);
    this.drawTableHeader(columns, widths);

    for (const row of rows) {
      const cells = row.map(toCell);
      doc.font(this.regular()).fontSize(TYPOGRAPHY.tableBody);
      const rowHeight =
        Math.max(
          ...cells.map((cell, index) =>
            doc.heightOfString(cell.text || '-', {
              width: widths[index] - CELL_PADDING * 2,
            }),
          ),
        ) +
        CELL_PADDING * 2;

      if (doc.y + rowHeight > this.contentBottom) {
        doc.addPage();
        this.drawTableHeader(columns, widths);
      }

      const top = doc.y;
      let x = PAGE_MARGIN;
      cells.forEach((cell, index) => {
        doc
          .font(cell.bold ? this.bold() : this.regular())
          .fontSize(TYPOGRAPHY.tableBody)
          .fillColor(cell.color ?? '#000000')
          .text(cell.text || '-', x + CELL_PADDING, top + CELL_PADDING, {
            width: widths[index] - CELL_PADDING * 2,
            align: columns[index].align ?? 'left',
          });
        x += widths[index];
      });

      doc.y = top + rowHeight;
      doc
        .lineWidth(0.4)
        .strokeColor(this.brand.lineColor)
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + this.contentWidth, doc.y)
        .stroke();
    }

    doc.fillColor('#000000');
    doc.moveDown(0.6);
  }

  private drawTableHeader(columns: TableColumn[], widths: number[]) {
    const doc = this.doc;
    doc.font(this.bold()).fontSize(TYPOGRAPHY.tableBody);
    const headerHeight =
      Math.max(
        ...columns.map((column, index) =>
          doc.heightOfString(column.header, {
            width: widths[index] - CELL_PADDING * 2,
          }),
        ),
      ) +
      CELL_PADDING * 2;

    const top = doc.y;
    doc.rect(PAGE_MARGIN, top, this.contentWidth, headerHeight).fill(
      this.brand.primaryColor,
    );

    let x = PAGE_MARGIN;
    columns.forEach((column, index) => {
      doc
        .font(this.bold())
        .fontSize(TYPOGRAPHY.tableBody)
        .fillColor('#FFFFFF')
        .text(column.header, x + CELL_PADDING, top + CELL_PADDING, {
          width: widths[index] - CELL_PADDING * 2,
          align: column.align ?? 'left',
        });
      x += widths[index];
    });

    doc.y = top + headerHeight;
    doc.fillColor('#000000');
  }

  private ensureSpace(height: number) {
    if (this.doc.y + height > this.contentBottom) {
      this.doc.addPage();
    }
  }

  /** Second pass so the total page count is known for "Page X of Y". */
  async finish(): Promise<Buffer> {
    const doc = this.doc;
    const range = doc.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      // The footer and watermark sit outside the text area. Without collapsing
      // the margins first, pdfkit reads them as overflow and appends a blank
      // page for every page it decorates.
      const margins = { ...doc.page.margins };
      doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
      if (this.options.watermark) this.drawWatermark();
      this.drawFooter(index - range.start + 1, range.count);
      doc.page.margins = margins;
    }

    doc.flushPages();
    doc.end();
    return this.done;
  }

  private drawWatermark() {
    const doc = this.doc;
    const centerX = doc.page.width / 2;
    const centerY = doc.page.height / 2;
    doc.save();
    doc.rotate(-40, { origin: [centerX, centerY] });
    doc
      .font(this.bold())
      .fontSize(54)
      .fillColor('#C00000')
      .opacity(0.1)
      .text(INTERNAL_WATERMARK, 0, centerY - 34, {
        width: doc.page.width,
        align: 'center',
        lineBreak: false,
      });
    doc.opacity(1).restore();
    doc.fillColor('#000000');
  }

  private drawFooter(pageNumber: number, totalPages: number) {
    const doc = this.doc;
    const baseline = doc.page.height - 34;
    doc
      .lineWidth(0.5)
      .strokeColor(this.brand.lineColor)
      .moveTo(PAGE_MARGIN, baseline - 8)
      .lineTo(doc.page.width - PAGE_MARGIN, baseline - 8)
      .stroke();
    doc
      .font(this.regular())
      .fontSize(TYPOGRAPHY.footer)
      .fillColor(this.brand.mutedColor)
      .text(this.options.documentRef, PAGE_MARGIN, baseline, {
        width: this.contentWidth / 2,
        lineBreak: false,
      });
    doc
      .font(this.regular())
      .fontSize(TYPOGRAPHY.footer)
      .fillColor(this.brand.mutedColor)
      .text(
        `Page ${pageNumber} of ${totalPages}`,
        PAGE_MARGIN + this.contentWidth / 2,
        baseline,
        { width: this.contentWidth / 2, align: 'right', lineBreak: false },
      );
    doc.fillColor('#000000');
  }
}
