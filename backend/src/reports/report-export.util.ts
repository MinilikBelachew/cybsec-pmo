import PDFDocument from 'pdfkit';

export type ReportSnapshot = {
  title: string;
  generatedAt: string;
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

function writeRows(
  doc: PDFKit.PDFDocument,
  rows: Array<Record<string, unknown>>,
  emptyMessage: string,
) {
  if (rows.length === 0) {
    doc.fontSize(10).text(emptyMessage);
    return;
  }
  for (const row of rows) {
    const text = Object.entries(row)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' | ');
    doc.fontSize(10).text(`• ${text}`);
  }
}

export function buildReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(snapshot.title);
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Generated ${snapshot.generatedAt}`);
    doc.moveDown().fillColor('#000000');

    doc.fontSize(15).text(`Health: ${snapshot.health.overallRag}`);
    for (const dimension of snapshot.health.dimensions) {
      doc
        .fontSize(10)
        .text(
          `${dimension.dimension}: ${dimension.ragStatus} (${dimension.score})`,
        );
    }

    doc.moveDown().fontSize(15).text('Milestones');
    writeRows(doc, snapshot.milestones, 'No milestones');
    doc.moveDown().fontSize(15).text('Open actions');
    writeRows(doc, snapshot.actionPoints, 'No open actions');
    doc.moveDown().fontSize(15).text('Missing data');
    writeRows(doc, snapshot.missingData, 'No unresolved data quality flags');
    doc.end();
  });
}
