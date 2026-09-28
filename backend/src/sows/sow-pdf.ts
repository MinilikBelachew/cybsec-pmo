import PDFDocument from 'pdfkit';

export type SowPdfSnapshot = {
  projectName: string;
  status: string;
  version: number;
  customerName?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  exclusions?: string | null;
  assumptions?: string | null;
  value?: string | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingModel?: string | null;
  engagementType?: string | null;
  approverSignatureName?: string | null;
  approvedAt: string | null;
  generatedAt: string;
};

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY = '#0f172a';
const ACCENT = '#0369a1';
const MUTED = '#64748b';

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

export function buildSowPdf(snapshot: SowPdfSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Letterhead bar
    doc.rect(0, 0, PAGE_WIDTH, 56).fill(PRIMARY);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Statement of Work', MARGIN, 18, { lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(snapshot.projectName, MARGIN, 36, {
        width: CONTENT_WIDTH * 0.65,
        lineBreak: false,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(snapshot.status, MARGIN, 18, {
        align: 'right',
        width: CONTENT_WIDTH,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`v${snapshot.version}`, MARGIN, 36, {
        align: 'right',
        width: CONTENT_WIDTH,
        lineBreak: false,
      });
    doc.rect(0, 56, PAGE_WIDTH, 3).fill(ACCENT);

    doc.y = 72;
    doc.fillColor(PRIMARY);

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(snapshot.projectName, { width: CONTENT_WIDTH });
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        [
          `Customer: ${dash(snapshot.customerName)}`,
          `Start: ${dash(snapshot.startDate)}`,
          `End: ${dash(snapshot.endDate)}`,
          `Generated: ${snapshot.generatedAt}`,
        ]
          .filter(Boolean)
          .join('  |  '),
        { width: CONTENT_WIDTH },
      );
    doc.fillColor('#000000');
    doc.moveDown(0.8);

    const section = (title: string, body: string | null) => {
      doc.moveDown(0.4);
      if (doc.y > 720) doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(PRIMARY)
        .text(title, { width: CONTENT_WIDTH });
      doc
        .moveTo(MARGIN, doc.y + 2)
        .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
        .strokeColor(ACCENT)
        .lineWidth(0.75)
        .stroke();
      doc.moveDown(0.45);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#000000')
        .text(dash(body), { width: CONTENT_WIDTH, align: 'left' });
    };

    section('1. Scope of work', snapshot.scope ?? null);
    section('2. Key deliverables', snapshot.deliverables ?? null);
    section('3. Exclusions', snapshot.exclusions ?? null);
    section('4. Assumptions', snapshot.assumptions ?? null);
    section(
      '5. Commercial terms',
      [
        snapshot.value
          ? `Value: ${snapshot.value} ${snapshot.currency ?? ''}`.trim()
          : null,
        snapshot.billingModel ? `Billing model: ${snapshot.billingModel}` : null,
        snapshot.engagementType
          ? `Engagement type: ${snapshot.engagementType}`
          : null,
      ]
        .filter(Boolean)
        .join('\n') || null,
    );

    section(
      '6. Approval & sign-off',
      [
        `Status: ${snapshot.status}`,
        snapshot.approverSignatureName
          ? `Signed as: ${snapshot.approverSignatureName}`
          : 'Signed as: —',
        snapshot.approvedAt
          ? `Approved at: ${snapshot.approvedAt}`
          : 'Approved at: —',
      ].join('\n'),
    );

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `Page ${i + 1} of ${range.count}  ·  Statement of Work  ·  ${snapshot.projectName}`,
          MARGIN,
          doc.page.height - 36,
          { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
        );
    }

    doc.end();
  });
}

export function sowPdfFileName(projectName: string, version: number): string {
  const safe = projectName
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
  return `SOW_${safe || 'Project'}_v${version}.pdf`;
}
