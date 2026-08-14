import {
  APPROVED_REPORT_RULES,
  addWorkingDays,
  daysBetween,
  milestoneRagFromVariance,
} from './approved-report.rules';
import {
  buildDocumentReference,
  buildExportFileName,
  deriveProjectRef,
  formatApprovedDate,
  formatSignatory,
  ragWord,
  resolveBrandProfile,
} from './cybersec-format.constants';
import { buildMomDocx, buildStatusReportDocx } from './cybersec-format-docx';
import { buildMomPdf, buildStatusReportPdf } from './cybersec-format-pdf';
import type {
  MomSnapshot,
  StatusReportSnapshot,
} from './cybersec-format.types';

const brand = resolveBrandProfile();

function statusSnapshot(
  overrides: Partial<StatusReportSnapshot> = {},
): StatusReportSnapshot {
  return {
    docType: 'WSR',
    audience: 'internal',
    title: 'WSR — Fortra DLP Rollout',
    projectName: 'Fortra DLP Rollout',
    periodLabel: '2026-07-20 to 2026-07-27',
    generatedAt: '2026-07-27T09:00:00.000Z',
    dataAsOf: '2026-07-27T09:00:00.000Z',
    brand,
    control: {
      documentRef: 'PRJ0142-WSR-20260727-v3',
      version: 3,
      projectName: 'Fortra DLP Rollout',
      customer: 'ADNOC',
      deliveredBy: 'CyberSec',
      reportPeriod: '2026-07-20 to 2026-07-27',
      dateIssued: '2026-07-27T09:00:00.000Z',
      preparedBy: 'Sara El Moursy, PMO Manager',
      reviewedBy: 'Omar Fahmy, Project Manager',
    },
    health: {
      overallRag: 'amber',
      previousOverallRag: 'green',
      overrideReason: null,
      dimensions: [
        {
          dimension: 'schedule',
          score: 72,
          ragStatus: 'amber',
          previousScore: 88,
          previousRag: 'green',
        },
        {
          dimension: 'cost',
          score: 91,
          ragStatus: 'green',
          previousScore: null,
          previousRag: null,
        },
      ],
    },
    milestones: [
      {
        title: 'PAM Design and Documentation',
        status: 'In Progress',
        baselineDate: '2026-06-30T00:00:00.000Z',
        expectedDate: '2026-07-10T00:00:00.000Z',
        varianceDays: 10,
        percentComplete: 62,
        ragStatus: 'amber',
        phase: 'Design',
      },
    ],
    phaseWork: [
      {
        phase: 'Design',
        completed: ['Drafted the PAM high level design'],
        planned: ['Walk the design through with the customer'],
      },
    ],
    actionPoints: [
      {
        title: 'Confirm the Cairo site firewall rules',
        owner: 'Omar Fahmy',
        dueDate: '2026-08-03T00:00:00.000Z',
        status: 'Open',
      },
    ],
    issues: [
      {
        description: 'Customer VPN access not yet provisioned',
        reportedDate: '2026-07-14T00:00:00.000Z',
        issueOwner: 'Omar Fahmy',
        targetResolutionDate: '2026-07-20T00:00:00.000Z',
        actualResolutionDate: null,
        status: 'Open',
      },
    ],
    risks: [
      {
        description: 'Issue unresolved 7 days past its target resolution date',
        category: 'Schedule',
        owner: 'Omar Fahmy',
        affectedMilestone: 'PAM Design and Documentation',
        source: 'system',
        exposure: 'internal',
        targetDate: '2026-07-20T00:00:00.000Z',
        status: 'Open',
        score: null,
      },
    ],
    pendingItems: [
      {
        item: 'Awaiting customer sign-off on the design',
        type: 'Action',
        requestedDate: '2026-07-12T00:00:00.000Z',
        daysWaiting: 15,
        owner: 'Omar Fahmy',
        sittingWith: null,
        holdingUp: 'Design',
        lastFollowUp: null,
      },
    ],
    cost: {
      currency: 'AED',
      baselineAmount: 480000,
      actualAmount: 512000,
      varianceAmount: -32000,
      actualEffortHours: 1840,
    },
    dataQuality: [
      { flagType: 'TIMESHEET_MISSING', description: 'Two engineers have not submitted last week' },
    ],
    phasesNotStarted: ['Knowledge Transfer'],
    ...overrides,
  };
}

function momSnapshot(overrides: Partial<MomSnapshot> = {}): MomSnapshot {
  return {
    docType: 'MoM',
    title: 'Weekly Status Review — Week 30',
    meetingType: 'Weekly Status Review',
    projectName: 'Fortra DLP Rollout',
    organisation: 'ADNOC',
    scheduledAt: '2026-07-27T11:30:00.000Z',
    timeZone: 'UTC',
    version: 2,
    generatedAt: '2026-07-27T12:00:00.000Z',
    brand,
    control: {
      documentRef: 'PRJ0142-MoM-20260727-v2',
      version: 2,
      projectName: 'Fortra DLP Rollout',
      customer: 'ADNOC',
      deliveredBy: 'CyberSec',
      reportPeriod: null,
      dateIssued: '2026-07-27T12:00:00.000Z',
      preparedBy: 'Sara El Moursy, PMO Manager',
      reviewedBy: null,
    },
    organiser: {
      name: 'Sara El Moursy',
      email: 'sara@example.com',
      organisation: 'CyberSec',
    },
    attendees: [
      {
        name: 'Omar Fahmy',
        email: 'omar@example.com',
        organisation: 'CyberSec',
        party: 'Internal',
        attended: null,
      },
      {
        name: 'Layla Hassan',
        email: 'layla@adnoc.example',
        organisation: 'ADNOC',
        party: 'Customer',
        attended: null,
      },
    ],
    keyPoints: ['Reviewed progress on the PAM rollout'],
    decisions: ['Start with the Cairo site before Dubai'],
    actions: [
      {
        reference: 'A01',
        action: 'Share the updated cutover plan',
        owner: 'Omar Fahmy',
        dueDate: '2026-08-03T00:00:00.000Z',
        status: 'Open',
      },
    ],
    ...overrides,
  };
}

function pdfPageCount(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches?.length ?? 0;
}

describe('approved CyberSec format helpers', () => {
  it('spells out calendar dates so the month is unambiguous', () => {
    expect(formatApprovedDate('2026-07-27T00:00:00.000Z')).toBe('July 27, 2026');
    expect(formatApprovedDate(null)).toBe('Not recorded');
  });

  it('names exports ProjectRef_Customer_Project_DocType_Date_vN', () => {
    expect(
      buildExportFileName({
        projectRef: 'PRJ0142',
        customerName: 'ADNOC',
        projectName: 'Fortra DLP Rollout',
        docType: 'WSR',
        date: '2026-07-27T00:00:00.000Z',
        version: 1,
        extension: 'pdf',
      }),
    ).toBe('PRJ0142_ADNOC_FortraDLPRollout_WSR_20260727_v1.pdf');
  });

  it('starts the file name date with the year so files sort in order', () => {
    const january = buildExportFileName({
      projectRef: 'PRJ1',
      customerName: 'C',
      projectName: 'P',
      docType: 'MSR',
      date: '2026-01-05T00:00:00.000Z',
      version: 2,
      extension: 'docx',
    });
    const december = buildExportFileName({
      projectRef: 'PRJ1',
      customerName: 'C',
      projectName: 'P',
      docType: 'MSR',
      date: '2026-12-05T00:00:00.000Z',
      version: 2,
      extension: 'docx',
    });
    expect([december, january].sort()).toEqual([january, december]);
  });

  it('builds a document reference and falls back when no PSA code exists', () => {
    expect(
      buildDocumentReference({
        projectRef: 'PRJ0142',
        docType: 'MoM',
        date: '2026-07-27T00:00:00.000Z',
        version: 4,
      }),
    ).toBe('PRJ0142-MoM-20260727-v4');
    expect(deriveProjectRef({ externalCode: 'abc-12', projectId: 'x' })).toBe(
      'ABC-12',
    );
    expect(
      deriveProjectRef({ externalCode: null, projectId: 'a1b2c3d4e5f6' }),
    ).toBe('PRJA1B2C3');
  });

  it('prints the status word so colour is never the only signal', () => {
    expect(ragWord('red')).toBe('Red');
    expect(ragWord('AMBER')).toBe('Amber');
    expect(ragWord(undefined)).toBe('Not recorded');
  });

  it('carries the full name and role on signatories', () => {
    expect(formatSignatory('Sara El Moursy', 'PMO Manager')).toBe(
      'Sara El Moursy, PMO Manager',
    );
    expect(formatSignatory('Sara El Moursy', null)).toBe('Sara El Moursy');
    expect(formatSignatory(null, 'PMO Manager')).toBeNull();
  });
});

describe('approved status report rules', () => {
  it('judges milestone slip as a share of the milestone length', () => {
    // A 10 day slip is 5% of 200 days but 50% of 20 days.
    expect(milestoneRagFromVariance(10, 200, false)).toBe('green');
    expect(milestoneRagFromVariance(20, 200, false)).toBe('amber');
    expect(milestoneRagFromVariance(40, 200, false)).toBe('red');
    expect(milestoneRagFromVariance(10, 20, false)).toBe('red');
  });

  it('judges a billing milestone on the tighter end', () => {
    expect(milestoneRagFromVariance(6, 200, false)).toBe('green');
    expect(milestoneRagFromVariance(6, 200, true)).toBe('amber');
    expect(milestoneRagFromVariance(20, 200, true)).toBe('red');
  });

  it('treats anything on or ahead of baseline as green', () => {
    expect(milestoneRagFromVariance(0, 100, true)).toBe('green');
    expect(milestoneRagFromVariance(-5, 100, true)).toBe('green');
    expect(milestoneRagFromVariance(null, 100, false)).toBeNull();
  });

  it('falls back to absolute day bands when no length is known', () => {
    expect(milestoneRagFromVariance(3, null, false)).toBe('green');
    expect(milestoneRagFromVariance(
      APPROVED_REPORT_RULES.taskLateDays.amber,
      null,
      false,
    )).toBe('amber');
    expect(milestoneRagFromVariance(20, null, false)).toBe('red');
  });

  it('adds working days, skipping weekends and public holidays', () => {
    // Monday 2026-07-27 plus five working days is Monday 2026-08-03.
    const fromMonday = addWorkingDays(new Date('2026-07-27T00:00:00.000Z'), 5);
    expect(fromMonday.toISOString().slice(0, 10)).toBe('2026-08-03');

    const withHoliday = addWorkingDays(
      new Date('2026-07-27T00:00:00.000Z'),
      5,
      [new Date('2026-07-29T00:00:00.000Z')],
    );
    expect(withHoliday.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('counts whole calendar days between two dates', () => {
    expect(
      daysBetween(
        new Date('2026-07-20T23:00:00.000Z'),
        new Date('2026-07-27T01:00:00.000Z'),
      ),
    ).toBe(7);
  });
});

describe('approved status report renderers', () => {
  it('renders a PDF with a page for every section', async () => {
    const buffer = await buildStatusReportPdf(statusSnapshot());
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(5000);
    expect(pdfPageCount(buffer)).toBeGreaterThan(1);
  });

  it('renders a DOCX package', async () => {
    const buffer = await buildStatusReportDocx(statusSnapshot());
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it('renders every section heading when the project has no data', async () => {
    const empty = statusSnapshot({
      health: {
        overallRag: 'green',
        previousOverallRag: null,
        overrideReason: null,
        dimensions: [],
      },
      milestones: [],
      phaseWork: [],
      actionPoints: [],
      issues: [],
      risks: [],
      pendingItems: [],
      cost: null,
      dataQuality: [],
      phasesNotStarted: [],
    });
    const [pdf, docx] = await Promise.all([
      buildStatusReportPdf(empty),
      buildStatusReportDocx(empty),
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });

  it('drops cost and data quality from the client document', async () => {
    const client = statusSnapshot({ audience: 'client', cost: null, dataQuality: [] });
    const internal = await buildStatusReportPdf(statusSnapshot());
    const external = await buildStatusReportPdf(client);
    // The internal document additionally carries cost, missing data and a watermark.
    expect(internal.length).toBeGreaterThan(external.length);
  });

  it('paginates a long report and keeps the footer on every page', async () => {
    const long = statusSnapshot({
      pendingItems: Array.from({ length: 90 }, (_, index) => ({
        item: `Pending item number ${index + 1} awaiting a response from the customer`,
        type: 'Action' as const,
        requestedDate: '2026-07-01T00:00:00.000Z',
        daysWaiting: index + 1,
        owner: 'Omar Fahmy',
        sittingWith: null,
        holdingUp: 'Design',
        lastFollowUp: null,
      })),
    });
    const buffer = await buildStatusReportPdf(long);
    expect(pdfPageCount(buffer)).toBeGreaterThan(2);
  });
});

describe('approved MoM renderers', () => {
  it('renders a PDF and a DOCX', async () => {
    const [pdf, docx] = await Promise.all([
      buildMomPdf(momSnapshot()),
      buildMomDocx(momSnapshot()),
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(docx.subarray(0, 2).toString()).toBe('PK');
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it('renders with no agenda, decisions, attendees or actions recorded', async () => {
    const empty = momSnapshot({
      meetingType: null,
      organisation: null,
      organiser: null,
      attendees: [],
      keyPoints: [],
      decisions: [],
      actions: [],
    });
    const pdf = await buildMomPdf(empty);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('adds no blank page when stamping the footer outside the text area', async () => {
    const pdf = await buildMomPdf(momSnapshot());
    expect(pdfPageCount(pdf)).toBe(1);
  });

  it('renders a letterhead logo from stored bytes', async () => {
    // 1x1 PNG: enough to exercise the measure-and-place path in the letterhead.
    const logoData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const withLogo = momSnapshot({
      brand: { ...brand, logoData, logoMimeType: 'image/png' },
    });
    const [pdf, docx] = await Promise.all([
      buildMomPdf(withLogo),
      buildMomDocx(withLogo),
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(docx.subarray(0, 2).toString()).toBe('PK');
    expect(pdfPageCount(pdf)).toBe(1);
  });
});
