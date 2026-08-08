import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import fs from 'node:fs';
import {
  BrandProfile,
  DOCX_FONT_FAMILY,
  INTERNAL_WATERMARK,
  MOM_ACKNOWLEDGEMENT_NOTE,
  NOT_RECORDED,
  ReportDocType,
  docTypeLabel,
  formatApprovedDate,
  formatApprovedDateTime,
  formatApprovedTime,
  ragColor,
  ragWord,
} from './cybersec-format.constants';
import type {
  DocumentControl,
  MomSnapshot,
  StatusReportSnapshot,
} from './cybersec-format.types';

type DocChild = Paragraph | Table;

type Cell = { text: string; color?: string; bold?: boolean };

const TITLE_SIZE = 32;
const HEADING_SIZE = 24;
const BODY_SIZE = 20;
const TABLE_SIZE = 18;
const SMALL_SIZE = 16;

function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

function dash(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : NOT_RECORDED;
}

function body(text: string, options: { bold?: boolean; color?: string } = {}) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        color: options.color ? hex(options.color) : undefined,
        size: BODY_SIZE,
      }),
    ],
  });
}

function muted(text: string, brand: BrandProfile, italics = true) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        italics,
        color: hex(brand.mutedColor),
        size: BODY_SIZE,
      }),
    ],
  });
}

function heading(text: string, brand: BrandProfile) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: hex(brand.accentColor),
      },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        color: hex(brand.primaryColor),
        size: HEADING_SIZE,
      }),
    ],
  });
}

function bullet(text: string, bold = false) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, bold, size: BODY_SIZE })],
  });
}

type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

function cellParagraph(cell: Cell, size: number, align?: Alignment) {
  return new Paragraph({
    alignment: align,
    children: [
      new TextRun({
        text: cell.text || '-',
        bold: cell.bold,
        color: cell.color ? hex(cell.color) : undefined,
        size,
      }),
    ],
  });
}

function alignmentOf(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return AlignmentType.RIGHT;
  if (align === 'center') return AlignmentType.CENTER;
  return AlignmentType.LEFT;
}

/** Header row carries tableHeader so Word repeats it across page breaks. */
function buildTable(
  brand: BrandProfile,
  columns: Array<{ header: string; width: number; align?: 'left' | 'right' | 'center' }>,
  rows: Array<Array<string | Cell>>,
): Table {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const percentages = columns.map((column) =>
    Math.round((column.width / total) * 100),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map(
          (column, index) =>
            new TableCell({
              width: { size: percentages[index], type: WidthType.PERCENTAGE },
              shading: {
                type: ShadingType.CLEAR,
                fill: hex(brand.primaryColor),
              },
              children: [
                cellParagraph(
                  { text: column.header, bold: true, color: '#FFFFFF' },
                  TABLE_SIZE,
                  alignmentOf(column.align),
                ),
              ],
            }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) => {
              const cell: Cell =
                typeof value === 'string' ? { text: value } : value;
              return new TableCell({
                width: { size: percentages[index], type: WidthType.PERCENTAGE },
                children: [
                  cellParagraph(
                    cell,
                    TABLE_SIZE,
                    alignmentOf(columns[index].align),
                  ),
                ],
              });
            }),
          }),
      ),
    ],
  });
}

/** Document control block: three label/value pairs per row. */
function buildControlBlock(
  brand: BrandProfile,
  entries: Array<[string, string]>,
): Table {
  const rows: TableRow[] = [];
  for (let index = 0; index < entries.length; index += 3) {
    const group = entries.slice(index, index + 3);
    while (group.length < 3) group.push(['', '']);
    rows.push(
      new TableRow({
        children: group.map(
          ([label, value]) =>
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: label.toUpperCase(),
                      bold: true,
                      color: hex(brand.mutedColor),
                      size: 14,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: value || '-', size: TABLE_SIZE }),
                  ],
                }),
              ],
            }),
        ),
      }),
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function brandHeader(
  brand: BrandProfile,
  docType: ReportDocType,
  subtitle: string,
  watermark: boolean,
) {
  const logoRun = (() => {
    const bytes = brand.logoData
      ? brand.logoData
      : brand.logoPath
        ? (() => {
            try {
              return fs.readFileSync(brand.logoPath);
            } catch {
              return null;
            }
          })()
        : null;
    if (!bytes) return null;
    const mime = (brand.logoMimeType ?? '').toLowerCase();
    const type = mime.includes('jpeg') || mime.includes('jpg')
      ? 'jpg'
      : mime.includes('gif')
        ? 'gif'
        : 'png';
    try {
      return new ImageRun({
        data: bytes,
        transformation: { width: 96, height: 32 },
        type,
      });
    } catch {
      return null;
    }
  })();

  const children: Paragraph[] = [
    new Paragraph({
      children: [
        ...(logoRun ? [logoRun, new TextRun({ text: '   ' })] : []),
        new TextRun({
          text: brand.companyName,
          bold: true,
          color: hex(brand.primaryColor),
          size: HEADING_SIZE,
        }),
        new TextRun({ text: '   |   ', color: hex(brand.mutedColor), size: BODY_SIZE }),
        new TextRun({
          text: docTypeLabel(docType),
          bold: true,
          color: hex(brand.accentColor),
          size: BODY_SIZE,
        }),
      ],
    }),
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: hex(brand.accentColor),
        },
      },
      children: [
        new TextRun({
          text: `${brand.documentOwner} · ${subtitle}`,
          color: hex(brand.mutedColor),
          size: SMALL_SIZE,
        }),
      ],
    }),
  ];

  if (watermark) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: INTERNAL_WATERMARK.toUpperCase(),
            bold: true,
            color: 'C00000',
            size: SMALL_SIZE,
          }),
        ],
      }),
    );
  }

  return new Header({ children });
}

/** Page X of Y beside the document reference, on every page. */
function brandFooter(brand: BrandProfile, documentRef: string) {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: 'right', position: 9020 }],
        children: [
          new TextRun({
            text: documentRef,
            color: hex(brand.mutedColor),
            size: SMALL_SIZE,
          }),
          new TextRun({ text: '\t', size: SMALL_SIZE }),
          new TextRun({
            children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
            color: hex(brand.mutedColor),
            size: SMALL_SIZE,
          }),
        ],
      }),
    ],
  });
}

function packDocument(
  brand: BrandProfile,
  docType: ReportDocType,
  subtitle: string,
  documentRef: string,
  watermark: boolean,
  children: DocChild[],
) {
  return Packer.toBuffer(
    new Document({
      styles: {
        default: {
          document: {
            run: { font: DOCX_FONT_FAMILY, size: BODY_SIZE },
          },
        },
      },
      sections: [
        {
          headers: { default: brandHeader(brand, docType, subtitle, watermark) },
          footers: { default: brandFooter(brand, documentRef) },
          children,
        },
      ],
    }),
  );
}

function controlEntries(control: DocumentControl): Array<[string, string]> {
  return [
    ['Document reference', control.documentRef],
    ['Version', `v${control.version}`],
    ['Project name', control.projectName],
    ['Customer', dash(control.customer)],
    ['Delivered by', dash(control.deliveredBy)],
    ['Report period', dash(control.reportPeriod)],
    ['Date issued', formatApprovedDate(control.dateIssued)],
    ['Prepared by', dash(control.preparedBy)],
    ['Reviewed by', dash(control.reviewedBy)],
  ];
}

function ragCell(value: string | null | undefined): Cell {
  return { text: ragWord(value), color: ragColor(value), bold: true };
}

function varianceCell(days: number | null): Cell {
  if (days == null) return { text: NOT_RECORDED };
  if (days === 0) return { text: 'On baseline' };
  return {
    text: days > 0 ? `+${days}` : String(days),
    color: days > 0 ? ragColor('red') : ragColor('green'),
  };
}

function trendCell(current: number, previous: number | null): Cell {
  if (previous == null) return { text: 'No prior report' };
  const delta = Math.round(current - previous);
  if (delta === 0) return { text: 'No change' };
  return {
    text: delta > 0 ? `Improved (+${delta})` : `Declined (${delta})`,
    color: delta > 0 ? ragColor('green') : ragColor('red'),
  };
}

export async function buildStatusReportDocx(
  snapshot: StatusReportSnapshot,
): Promise<Buffer> {
  const brand = snapshot.brand;
  const isInternal = snapshot.audience === 'internal';
  const children: DocChild[] = [];

  let sectionNumber = 0;
  const section = (label: string) => {
    sectionNumber += 1;
    children.push(heading(`${sectionNumber}. ${label}`, brand));
  };

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: snapshot.title,
          bold: true,
          color: hex(brand.primaryColor),
          size: TITLE_SIZE,
        }),
      ],
    }),
    muted(
      `Reporting period: ${dash(snapshot.periodLabel)}   |   Data as at ${formatApprovedDateTime(snapshot.dataAsOf)}`,
      brand,
      false,
    ),
    buildControlBlock(brand, controlEntries(snapshot.control)),
  );

  section('Executive health summary');
  children.push(
    body(
      `Overall status: ${ragWord(snapshot.health.overallRag)}${
        snapshot.health.previousOverallRag
          ? `   (previous period: ${ragWord(snapshot.health.previousOverallRag)})`
          : ''
      }`,
      { bold: true, color: ragColor(snapshot.health.overallRag) },
    ),
  );
  if (snapshot.health.dimensions.length === 0) {
    children.push(
      muted('No health dimensions were evaluated for this period.', brand),
    );
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Dimension', width: 24 },
          { header: 'Status', width: 14 },
          { header: 'Score', width: 12, align: 'right' },
          { header: 'Previous status', width: 18 },
          { header: 'Previous score', width: 14, align: 'right' },
          { header: 'Direction', width: 18 },
        ],
        snapshot.health.dimensions.map((row) => [
          { text: row.dimension, bold: true },
          ragCell(row.ragStatus),
          String(Math.round(row.score)),
          { text: row.previousRag ? ragWord(row.previousRag) : 'No prior report' },
          row.previousScore == null ? '-' : String(Math.round(row.previousScore)),
          trendCell(row.score, row.previousScore),
        ]),
      ),
    );
  }
  if (snapshot.health.overrideReason) {
    children.push(
      muted(`Manual override reason: ${snapshot.health.overrideReason}`, brand),
    );
  }

  section('Milestones');
  if (snapshot.milestones.length === 0) {
    children.push(muted('No milestones reported this period.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Milestone', width: 30 },
          { header: 'Status', width: 12 },
          { header: 'Baseline date', width: 15 },
          { header: 'Expected date', width: 15 },
          { header: 'Variance (days)', width: 12, align: 'right' },
          { header: '% complete', width: 10, align: 'right' },
          { header: 'RAG', width: 9 },
        ],
        snapshot.milestones.map((row) => [
          { text: row.title, bold: true },
          row.status,
          formatApprovedDate(row.baselineDate),
          formatApprovedDate(row.expectedDate),
          varianceCell(row.varianceDays),
          row.percentComplete == null
            ? NOT_RECORDED
            : `${Math.round(row.percentComplete)}%`,
          ragCell(row.ragStatus),
        ]),
      ),
    );
  }

  section('Work completed and work planned');
  if (snapshot.phaseWork.length === 0) {
    children.push(muted('No phase activity recorded for this period.', brand));
  } else {
    for (const group of snapshot.phaseWork) {
      children.push(body(group.phase, { bold: true }));
      children.push(muted('Completed this period', brand, false));
      children.push(
        ...(group.completed.length
          ? group.completed.map((text) => bullet(text))
          : [muted('Nothing completed in this period.', brand)]),
      );
      children.push(muted('Planned next period', brand, false));
      children.push(
        ...(group.planned.length
          ? group.planned.map((text) => bullet(text))
          : [muted('Nothing planned in this period.', brand)]),
      );
    }
  }

  section('Open action points');
  if (snapshot.actionPoints.length === 0) {
    children.push(muted('No open action points.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Action', width: 46 },
          { header: 'Owner', width: 20 },
          { header: 'Due date', width: 20 },
          { header: 'Status', width: 14 },
        ],
        snapshot.actionPoints.map((row) => [
          row.title,
          dash(row.owner),
          formatApprovedDate(row.dueDate),
          row.status,
        ]),
      ),
    );
  }

  section('Issues');
  if (snapshot.issues.length === 0) {
    children.push(muted('No issues reported this period.', brand));
  } else {
    for (const issue of snapshot.issues) {
      children.push(body(issue.description, { bold: true }));
      children.push(
        buildControlBlock(brand, [
          ['Date reported', formatApprovedDate(issue.reportedDate)],
          [
            'Blocking',
            issue.isBlocking == null
              ? NOT_RECORDED
              : issue.isBlocking
                ? 'Yes'
                : 'No',
          ],
          ['Blocks', dash(issue.blocks)],
          ['Action required', dash(issue.actionRequired)],
          ['Issue owner', dash(issue.issueOwner)],
          ['Action owner', dash(issue.actionOwner)],
          ['Customer dependency', dash(issue.dependency)],
          ['Target resolution', formatApprovedDate(issue.targetResolutionDate)],
          [
            'Actual resolution',
            issue.actualResolutionDate
              ? formatApprovedDate(issue.actualResolutionDate)
              : 'Open',
          ],
        ]),
      );
    }
  }

  section('Risks');
  if (snapshot.risks.length === 0) {
    children.push(muted('No risks raised against this project.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Risk', width: 28 },
          { header: 'Category', width: 12 },
          { header: 'Owner', width: 13 },
          { header: 'Affected milestone', width: 16 },
          { header: 'Raised', width: 9 },
          { header: 'Target date', width: 13 },
          { header: 'Status', width: 9 },
        ],
        snapshot.risks.map((row) => [
          row.description,
          dash(row.category),
          dash(row.owner),
          dash(row.affectedMilestone),
          row.source === 'system' ? 'System' : 'Manual',
          formatApprovedDate(row.targetDate),
          row.status,
        ]),
      ),
    );
  }

  section('Pending items');
  if (snapshot.pendingItems.length === 0) {
    children.push(muted('No pending items are past their date.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Item', width: 22 },
          { header: 'Type', width: 8 },
          { header: 'Date requested', width: 12 },
          { header: 'Days waiting', width: 8, align: 'right' },
          { header: 'Owner', width: 12 },
          { header: 'Sitting with', width: 12 },
          { header: 'Holding up', width: 15 },
          { header: 'Last follow-up', width: 11 },
        ],
        snapshot.pendingItems.map((row) => [
          row.item,
          row.type,
          formatApprovedDate(row.requestedDate),
          row.daysWaiting == null ? '-' : String(row.daysWaiting),
          dash(row.owner),
          dash(row.sittingWith),
          dash(row.holdingUp),
          row.lastFollowUp ? formatApprovedDate(row.lastFollowUp) : NOT_RECORDED,
        ]),
      ),
    );
  }

  if (isInternal) {
    section('Cost');
    if (!snapshot.cost) {
      children.push(
        muted('No baseline budget is recorded for this project.', brand),
      );
    } else {
      const { currency, baselineAmount, actualAmount, varianceAmount } =
        snapshot.cost;
      const money = (value: number | null) =>
        value == null
          ? NOT_RECORDED
          : `${currency} ${value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
      children.push(
        buildTable(
          brand,
          [
            { header: 'Baseline', width: 25, align: 'right' },
            { header: 'Actual', width: 25, align: 'right' },
            { header: 'Variance', width: 25, align: 'right' },
            { header: 'Actual effort (hours)', width: 25, align: 'right' },
          ],
          [
            [
              money(baselineAmount),
              money(actualAmount),
              {
                text: money(varianceAmount),
                color:
                  varianceAmount != null && varianceAmount < 0
                    ? ragColor('red')
                    : ragColor('green'),
              },
              snapshot.cost.actualEffortHours == null
                ? NOT_RECORDED
                : String(Math.round(snapshot.cost.actualEffortHours)),
            ],
          ],
        ),
      );
    }

    section('Missing or incomplete data');
    if (snapshot.dataQuality.length === 0) {
      children.push(muted('No missing or incomplete data flagged.', brand));
    } else {
      children.push(
        buildTable(
          brand,
          [
            { header: 'Type of gap', width: 30 },
            { header: 'Description', width: 70 },
          ],
          snapshot.dataQuality.map((row) => [row.flagType, row.description]),
        ),
      );
    }
  }

  children.push(heading('Notes', brand));
  if (snapshot.phasesNotStarted.length === 0) {
    children.push(muted('All project phases have started.', brand));
  } else {
    children.push(body('Phases not yet started:'));
    children.push(...snapshot.phasesNotStarted.map((text) => bullet(text)));
  }

  return packDocument(
    brand,
    snapshot.docType,
    snapshot.projectName,
    snapshot.control.documentRef,
    isInternal,
    children,
  );
}

export async function buildMomDocx(snapshot: MomSnapshot): Promise<Buffer> {
  const brand = snapshot.brand;
  const children: DocChild[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `Minutes of Meeting — ${snapshot.title}`,
          bold: true,
          color: hex(brand.primaryColor),
          size: TITLE_SIZE,
        }),
      ],
    }),
    muted(
      `${dash(snapshot.meetingType)}   |   ${formatApprovedDateTime(snapshot.scheduledAt, snapshot.timeZone)}`,
      brand,
      false,
    ),
    buildControlBlock(brand, [
      ['Document reference', snapshot.control.documentRef],
      ['Version', `v${snapshot.control.version}`],
      ['Project name', snapshot.control.projectName],
      ['Organisation', dash(snapshot.organisation)],
      ['Meeting type', dash(snapshot.meetingType)],
      ['Meeting name', snapshot.title],
      ['Meeting date', formatApprovedDate(snapshot.scheduledAt)],
      [
        'Meeting time',
        formatApprovedTime(snapshot.scheduledAt, snapshot.timeZone),
      ],
      ['Prepared by', dash(snapshot.control.preparedBy)],
    ]),
    heading('1. Attendance', brand),
    body(
      `Organiser: ${dash(snapshot.organiser?.name)}${
        snapshot.organiser?.email ? ` (${snapshot.organiser.email})` : ''
      }${snapshot.organiser?.organisation ? ` — ${snapshot.organiser.organisation}` : ''}`,
      { bold: true },
    ),
  ];

  if (snapshot.attendees.length === 0) {
    children.push(muted('No attendees recorded.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Attendee', width: 24 },
          { header: 'Email', width: 30 },
          { header: 'Organisation', width: 20 },
          { header: 'Side', width: 14 },
          { header: 'Attended', width: 12 },
        ],
        snapshot.attendees.map((row) => [
          row.name,
          dash(row.email),
          dash(row.organisation),
          dash(row.party),
          row.attended == null ? NOT_RECORDED : row.attended ? 'Yes' : 'No',
        ]),
      ),
    );
  }

  children.push(heading('2. Key points discussed', brand));
  if (snapshot.keyPoints.length === 0) {
    children.push(muted('No agenda items recorded.', brand));
  } else {
    children.push(...snapshot.keyPoints.map((text) => bullet(text)));
  }

  children.push(heading('3. Decisions', brand));
  if (snapshot.decisions.length === 0) {
    children.push(muted('No decisions recorded.', brand));
  } else {
    children.push(...snapshot.decisions.map((text) => bullet(text)));
  }

  children.push(heading('4. Action points', brand));
  if (snapshot.actions.length === 0) {
    children.push(muted('No action points recorded.', brand));
  } else {
    children.push(
      buildTable(
        brand,
        [
          { header: 'Ref', width: 8 },
          { header: 'Action', width: 44 },
          { header: 'Owner', width: 18 },
          { header: 'Due date', width: 18 },
          { header: 'Status', width: 12 },
        ],
        snapshot.actions.map((row) => [
          row.reference,
          row.action,
          dash(row.owner),
          formatApprovedDate(row.dueDate),
          row.status,
        ]),
      ),
    );
  }

  children.push(heading('5. Acknowledgement', brand));
  children.push(body(MOM_ACKNOWLEDGEMENT_NOTE));

  return packDocument(
    brand,
    'MoM',
    snapshot.projectName,
    snapshot.control.documentRef,
    false,
    children,
  );
}
