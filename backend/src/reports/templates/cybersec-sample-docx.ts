import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import {
  CYBERSEC_SAMPLE_TEMPLATE,
  StatusReportKind,
  formatRagLabel,
  reportKindLabel,
} from './cybersec-sample.branding';
import type { MomSnapshot, ReportSnapshot } from './cybersec-sample-pdf';

function brandHeader(kind: StatusReportKind, subtitle: string) {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: CYBERSEC_SAMPLE_TEMPLATE.brandName,
            bold: true,
            color: '0B3D5C',
            size: 28,
          }),
          new TextRun({ text: '  |  ', color: '5A6A75', size: 20 }),
          new TextRun({
            text: reportKindLabel(kind),
            color: 'C45C26',
            bold: true,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${CYBERSEC_SAMPLE_TEMPLATE.productName} · ${subtitle}`,
            color: '5A6A75',
            size: 16,
          }),
        ],
      }),
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: 'C45C26' },
        },
        children: [
          new TextRun({
            text: CYBERSEC_SAMPLE_TEMPLATE.confidentiality,
            italics: true,
            color: '5A6A75',
            size: 14,
          }),
        ],
      }),
    ],
  });
}

function brandFooter() {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `${CYBERSEC_SAMPLE_TEMPLATE.notice} · ${CYBERSEC_SAMPLE_TEMPLATE.templateVersion} · Page `,
            color: '5A6A75',
            size: 14,
          }),
          new TextRun({ children: [PageNumber.CURRENT], color: '5A6A75', size: 14 }),
        ],
      }),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
  });
}

function bullets(
  rows: Array<Record<string, unknown>>,
  empty: string,
  formatter?: (row: Record<string, unknown>) => string,
): Paragraph[] {
  if (rows.length === 0) {
    return [new Paragraph({ children: [new TextRun({ text: empty, italics: true })] })];
  }
  return rows.map(
    (row) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun(
            formatter
              ? formatter(row)
              : Object.entries(row)
                  .filter(([, value]) => value != null)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(' · '),
          ),
        ],
      }),
  );
}

export async function buildReportDocx(snapshot: ReportSnapshot): Promise<Buffer> {
  const kind = snapshot.reportType ?? 'WSR';
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: snapshot.title,
          bold: true,
          size: 32,
          color: '0B3D5C',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${snapshot.generatedAt}`,
          color: '5A6A75',
          size: 18,
        }),
      ],
    }),
    heading('1. Executive health summary'),
    new Paragraph({
      children: [
        new TextRun({
          text: `Overall RAG: ${formatRagLabel(snapshot.health.overallRag)}`,
          bold: true,
        }),
      ],
    }),
    ...snapshot.health.dimensions.map(
      (item) =>
        new Paragraph(
          `${item.dimension}: ${formatRagLabel(item.ragStatus)} (${item.score})`,
        ),
    ),
    heading('2. Milestones'),
    ...bullets(
      snapshot.milestones,
      'No milestones recorded for this period.',
      (row) =>
        `${String(row.title ?? 'Milestone')} · ${String(row.status ?? 'n/a')} · target ${String(row.targetDate ?? 'n/a')}`,
    ),
    heading('3. Open action points'),
    ...bullets(
      snapshot.actionPoints,
      'No open action points.',
      (row) =>
        `${String(row.title ?? 'Action')} · owner ${String(row.owner ?? 'unassigned')} · due ${String(row.dueDate ?? 'n/a')}`,
    ),
    heading('4. Missing / incomplete data'),
    ...bullets(
      snapshot.missingData,
      'No unresolved data-quality flags.',
      (row) =>
        `[${String(row.severity ?? 'medium').toUpperCase()}] ${String(row.flagType ?? 'FLAG')}: ${String(row.description ?? '')}`,
    ),
    heading('5. Approval note'),
    new Paragraph(
      'This pack follows the interim CyberSec section layout. Distribute only after PM approval.',
    ),
  ];

  return Packer.toBuffer(
    new Document({
      sections: [
        {
          headers: {
            default: brandHeader(
              kind,
              snapshot.projectName ?? snapshot.periodLabel ?? 'Status pack',
            ),
          },
          footers: { default: brandFooter() },
          children,
        },
      ],
    }),
  );
}

export async function buildMomDocx(snapshot: MomSnapshot): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `Minutes of Meeting — ${snapshot.title}`,
          bold: true,
          size: 32,
          color: '0B3D5C',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Scheduled: ${snapshot.scheduledAt}${snapshot.version != null ? ` · v${snapshot.version}` : ''}`,
          color: '5A6A75',
          size: 18,
        }),
      ],
    }),
    heading('1. Attendance'),
    new Paragraph(
      `Organiser: ${snapshot.organiser?.displayName ?? 'n/a'}`,
    ),
    ...bullets(
      (snapshot.attendees ?? []).map((person) => ({
        name: person.displayName,
        email: person.email,
      })),
      'No attendees recorded.',
      (row) =>
        `${String(row.name ?? 'Attendee')}${row.email ? ` <${String(row.email)}>` : ''}`,
    ),
    heading('2. Agenda'),
    ...bullets(
      (snapshot.agenda ?? []).map((item) => ({ content: item.content })),
      'No agenda items.',
      (row) => String(row.content ?? ''),
    ),
    heading('3. Decisions'),
    ...bullets(
      (snapshot.decisions ?? []).map((item) => ({ content: item.content })),
      'No decisions recorded.',
      (row) => String(row.content ?? ''),
    ),
    heading('4. Action points'),
    ...bullets(
      (snapshot.actions ?? []).map((item) => ({
        content: item.content,
        owner: item.owner?.displayName,
      })),
      'No actions recorded.',
      (row) =>
        `${String(row.content ?? '')}${row.owner ? ` — owner: ${String(row.owner)}` : ''}`,
    ),
    heading('5. Acknowledgement'),
    new Paragraph(
      'Attendees acknowledge these minutes in CyberSec PMO. Interim sample letterhead pending approved CyberSec MoM template.',
    ),
  ];

  return Packer.toBuffer(
    new Document({
      sections: [
        {
          headers: {
            default: brandHeader('MoM', snapshot.projectName ?? snapshot.title),
          },
          footers: { default: brandFooter() },
          children,
        },
      ],
    }),
  );
}
