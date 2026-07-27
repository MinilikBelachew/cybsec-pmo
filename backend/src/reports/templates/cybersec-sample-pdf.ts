import PDFDocument from 'pdfkit';
import {
  CYBERSEC_SAMPLE_TEMPLATE,
  StatusReportKind,
  formatRagLabel,
  reportKindLabel,
} from './cybersec-sample.branding';

export type ReportSnapshot = {
  title: string;
  generatedAt: string;
  reportType?: StatusReportKind;
  projectName?: string;
  periodLabel?: string;
  health: {
    overallRag: string;
    dimensions: Array<{
      dimension: string;
      score: number;
      ragStatus: string;
    }>;
  };
  milestones: Array<Record<string, unknown>>;
  actionPoints: Array<Record<string, unknown>>;
  missingData: Array<Record<string, unknown>>;
};

export type MomSnapshot = {
  title: string;
  scheduledAt: string;
  projectName?: string;
  organiser?: { displayName?: string; email?: string } | null;
  attendees?: Array<{ displayName?: string; email?: string }>;
  agenda?: Array<{ content?: string }>;
  decisions?: Array<{ content?: string }>;
  actions?: Array<{ content?: string; owner?: { displayName?: string } | null }>;
  version?: number;
  generatedAt?: string;
};

function drawHeader(
  doc: PDFKit.PDFDocument,
  kind: StatusReportKind,
  subtitle: string,
) {
  const { colors, brandName, productName, confidentiality } =
    CYBERSEC_SAMPLE_TEMPLATE;

  doc.rect(0, 0, doc.page.width, 72).fill(colors.primary);
  doc
    .fillColor('#FFFFFF')
    .fontSize(16)
    .text(brandName, 48, 18, { continued: false });
  doc.fontSize(10).text(productName, 48, 40);
  doc
    .fontSize(11)
    .text(reportKindLabel(kind), 48, 18, {
      align: 'right',
      width: doc.page.width - 96,
    });
  doc.fontSize(9).text(subtitle, 48, 40, {
    align: 'right',
    width: doc.page.width - 96,
  });

  doc
    .fillColor(colors.accent)
    .rect(0, 72, doc.page.width, 4)
    .fill();

  doc
    .fillColor(colors.muted)
    .fontSize(8)
    .text(confidentiality, 48, 84, {
      width: doc.page.width - 96,
      align: 'left',
    });

  doc.y = 108;
  doc.fillColor('#000000');
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const { notice, templateVersion, colors } = CYBERSEC_SAMPLE_TEMPLATE;
  const bottom = doc.page.height - 42;
  doc
    .strokeColor(colors.line)
    .moveTo(48, bottom - 10)
    .lineTo(doc.page.width - 48, bottom - 10)
    .stroke();
  doc
    .fillColor(colors.muted)
    .fontSize(7)
    .text(`${notice} · ${templateVersion}`, 48, bottom, {
      width: doc.page.width - 96,
      align: 'left',
    });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  const { colors } = CYBERSEC_SAMPLE_TEMPLATE;
  doc.moveDown(0.8);
  doc.fillColor(colors.primary).fontSize(13).text(title);
  doc
    .strokeColor(colors.line)
    .moveTo(48, doc.y + 2)
    .lineTo(doc.page.width - 48, doc.y + 2)
    .stroke();
  doc.moveDown(0.5).fillColor('#000000');
}

function writeBullets(
  doc: PDFKit.PDFDocument,
  rows: Array<Record<string, unknown>>,
  emptyMessage: string,
  formatter?: (row: Record<string, unknown>) => string,
) {
  if (rows.length === 0) {
    doc.fontSize(10).fillColor('#666666').text(emptyMessage);
    doc.fillColor('#000000');
    return;
  }
  for (const row of rows) {
    const text = formatter
      ? formatter(row)
      : Object.entries(row)
          .filter(([, value]) => value != null)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(' · ');
    doc.fontSize(10).text(`• ${text}`, { paragraphGap: 2 });
  }
}

function ragColor(status: string): string {
  const key = status.toLowerCase() as 'green' | 'amber' | 'red';
  return (
    CYBERSEC_SAMPLE_TEMPLATE.colors.rag[key] ??
    CYBERSEC_SAMPLE_TEMPLATE.colors.muted
  );
}

export function buildReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const kind = snapshot.reportType ?? 'WSR';
    drawHeader(
      doc,
      kind,
      snapshot.projectName ?? snapshot.periodLabel ?? 'Project status pack',
    );

    doc.fontSize(18).fillColor(CYBERSEC_SAMPLE_TEMPLATE.colors.primary).text(snapshot.title);
    doc
      .fontSize(9)
      .fillColor(CYBERSEC_SAMPLE_TEMPLATE.colors.muted)
      .text(`Generated ${snapshot.generatedAt}`);
    if (snapshot.periodLabel) {
      doc.text(`Reporting period: ${snapshot.periodLabel}`);
    }
    doc.moveDown(0.6).fillColor('#000000');

    sectionTitle(doc, '1. Executive health summary');
    doc
      .fontSize(12)
      .fillColor(ragColor(snapshot.health.overallRag))
      .text(`Overall RAG: ${formatRagLabel(snapshot.health.overallRag)}`);
    doc.fillColor('#000000').moveDown(0.3);
    for (const dimension of snapshot.health.dimensions) {
      doc
        .fontSize(10)
        .fillColor(ragColor(dimension.ragStatus))
        .text(
          `${dimension.dimension.toUpperCase()}: ${formatRagLabel(dimension.ragStatus)} (${dimension.score})`,
        );
    }
    doc.fillColor('#000000');

    sectionTitle(doc, '2. Milestones');
    writeBullets(
      doc,
      snapshot.milestones,
      'No milestones recorded for this period.',
      (row) =>
        `${String(row.title ?? 'Milestone')} · ${String(row.status ?? 'n/a')} · target ${String(row.targetDate ?? 'n/a')}`,
    );

    sectionTitle(doc, '3. Open action points');
    writeBullets(
      doc,
      snapshot.actionPoints,
      'No open action points.',
      (row) =>
        `${String(row.title ?? 'Action')} · owner ${String(row.owner ?? 'unassigned')} · due ${String(row.dueDate ?? 'n/a')} · ${String(row.status ?? '')}`,
    );

    sectionTitle(doc, '4. Missing / incomplete data');
    writeBullets(
      doc,
      snapshot.missingData,
      'No unresolved data-quality flags.',
      (row) =>
        `[${String(row.severity ?? 'medium').toUpperCase()}] ${String(row.flagType ?? 'FLAG')}: ${String(row.description ?? '')}`,
    );

    sectionTitle(doc, '5. Approval note');
    doc
      .fontSize(10)
      .text(
        'This pack follows the interim CyberSec section layout (progress/health, milestones, actions, missing data). Distribute only after PM approval.',
      );

    drawFooter(doc);
    doc.end();
  });
}

export function buildMomPdf(snapshot: MomSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(
      doc,
      'MoM',
      snapshot.projectName ?? snapshot.title,
    );

    doc
      .fontSize(18)
      .fillColor(CYBERSEC_SAMPLE_TEMPLATE.colors.primary)
      .text(`Minutes of Meeting — ${snapshot.title}`);
    doc
      .fontSize(9)
      .fillColor(CYBERSEC_SAMPLE_TEMPLATE.colors.muted)
      .text(`Scheduled: ${snapshot.scheduledAt}`);
    if (snapshot.version != null) {
      doc.text(`Document version: v${snapshot.version}`);
    }
    if (snapshot.generatedAt) {
      doc.text(`Generated: ${snapshot.generatedAt}`);
    }
    doc.moveDown(0.5).fillColor('#000000');

    sectionTitle(doc, '1. Attendance');
    doc
      .fontSize(10)
      .text(
        `Organiser: ${snapshot.organiser?.displayName ?? 'n/a'}${snapshot.organiser?.email ? ` <${snapshot.organiser.email}>` : ''}`,
      );
    writeBullets(
      doc,
      (snapshot.attendees ?? []).map((person) => ({
        name: person.displayName,
        email: person.email,
      })),
      'No attendees recorded.',
      (row) =>
        `${String(row.name ?? 'Attendee')}${row.email ? ` <${String(row.email)}>` : ''}`,
    );

    sectionTitle(doc, '2. Agenda');
    writeBullets(
      doc,
      (snapshot.agenda ?? []).map((item) => ({ content: item.content })),
      'No agenda items.',
      (row) => String(row.content ?? ''),
    );

    sectionTitle(doc, '3. Decisions');
    writeBullets(
      doc,
      (snapshot.decisions ?? []).map((item) => ({ content: item.content })),
      'No decisions recorded.',
      (row) => String(row.content ?? ''),
    );

    sectionTitle(doc, '4. Action points');
    writeBullets(
      doc,
      (snapshot.actions ?? []).map((item) => ({
        content: item.content,
        owner: item.owner?.displayName,
      })),
      'No actions recorded.',
      (row) =>
        `${String(row.content ?? '')}${row.owner ? ` — owner: ${String(row.owner)}` : ''}`,
    );

    sectionTitle(doc, '5. Acknowledgement');
    doc
      .fontSize(10)
      .text(
        'Attendees acknowledge these minutes by confirming in the CyberSec PMO workspace. Interim sample MoM letterhead — replace with approved CyberSec template when provided.',
      );

    drawFooter(doc);
    doc.end();
  });
}
