import {
  MOM_ACKNOWLEDGEMENT_NOTE,
  NOT_RECORDED,
  formatApprovedDate,
  formatApprovedDateTime,
  formatApprovedTime,
  ragColor,
  ragWord,
} from './cybersec-format.constants';
import { ApprovedPdfWriter, type TableCell } from './cybersec-format-pdf.layout';
import type {
  DocumentControl,
  MomSnapshot,
  StatusReportSnapshot,
} from './cybersec-format.types';

function dash(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : NOT_RECORDED;
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

function ragCell(value: string | null | undefined): TableCell {
  return { text: ragWord(value), color: ragColor(value), bold: true };
}

function varianceCell(days: number | null): TableCell {
  if (days == null) return { text: NOT_RECORDED };
  if (days === 0) return { text: 'On baseline' };
  return {
    text: days > 0 ? `+${days}` : String(days),
    color: days > 0 ? ragColor('red') : ragColor('green'),
  };
}

function percentCell(value: number | null): string {
  return value == null ? NOT_RECORDED : `${Math.round(value)}%`;
}

function trendCell(current: number, previous: number | null): TableCell {
  if (previous == null) return { text: 'No prior report' };
  const delta = Math.round(current - previous);
  if (delta === 0) return { text: 'No change' };
  return {
    text: delta > 0 ? `Improved (+${delta})` : `Declined (${delta})`,
    color: delta > 0 ? ragColor('green') : ragColor('red'),
  };
}

export async function buildStatusReportPdf(
  snapshot: StatusReportSnapshot,
): Promise<Buffer> {
  const isInternal = snapshot.audience === 'internal';
  const writer = new ApprovedPdfWriter(snapshot.brand, {
    docType: snapshot.docType,
    subtitle: snapshot.projectName,
    documentRef: snapshot.control.documentRef,
    watermark: isInternal,
  });

  let sectionNumber = 0;
  const section = (label: string) => {
    sectionNumber += 1;
    writer.section(`${sectionNumber}. ${label}`);
  };

  writer.title(snapshot.title, [
    `Reporting period: ${dash(snapshot.periodLabel)}`,
    `Data as at ${formatApprovedDateTime(snapshot.dataAsOf)}`,
  ]);

  writer.controlBlock(controlEntries(snapshot.control));

  section('Executive health summary');
  writer.paragraph(
    `Overall status: ${ragWord(snapshot.health.overallRag)}${
      snapshot.health.previousOverallRag
        ? `   (previous period: ${ragWord(snapshot.health.previousOverallRag)})`
        : ''
    }`,
    { bold: true, color: ragColor(snapshot.health.overallRag) },
  );
  if (snapshot.health.dimensions.length === 0) {
    writer.nothingToReport('No health dimensions were evaluated for this period.');
  } else {
    writer.table(
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
    );
  }
  if (snapshot.health.overrideReason) {
    writer.paragraph(
      `Manual override reason: ${snapshot.health.overrideReason}`,
      { color: snapshot.brand.mutedColor },
    );
  }

  section('Milestones');
  if (snapshot.milestones.length === 0) {
    writer.nothingToReport('No milestones reported this period.');
  } else {
    writer.table(
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
        percentCell(row.percentComplete),
        ragCell(row.ragStatus),
      ]),
    );
  }

  section('Work completed and work planned');
  if (snapshot.phaseWork.length === 0) {
    writer.nothingToReport('No phase activity recorded for this period.');
  } else {
    for (const group of snapshot.phaseWork) {
      writer.paragraph(group.phase, { bold: true });
      writer.paragraph('Completed this period', {
        color: snapshot.brand.mutedColor,
        indent: 10,
      });
      if (group.completed.length === 0) {
        writer.paragraph(`\u2022  ${'Nothing completed in this period.'}`, {
          color: snapshot.brand.mutedColor,
          indent: 20,
        });
      } else {
        writer.bulletList(group.completed.map((text) => ({ text })));
      }
      writer.paragraph('Planned next period', {
        color: snapshot.brand.mutedColor,
        indent: 10,
      });
      if (group.planned.length === 0) {
        writer.paragraph(`\u2022  ${'Nothing planned in this period.'}`, {
          color: snapshot.brand.mutedColor,
          indent: 20,
        });
      } else {
        writer.bulletList(group.planned.map((text) => ({ text })));
      }
    }
  }

  section('Open action points');
  if (snapshot.actionPoints.length === 0) {
    writer.nothingToReport('No open action points.');
  } else {
    writer.table(
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
    );
  }

  section('Issues');
  if (snapshot.issues.length === 0) {
    writer.nothingToReport('No issues reported this period.');
  } else {
    writer.table(
      [
        { header: 'Issue', width: 24 },
        { header: 'Date reported', width: 16 },
        { header: 'Issue owner', width: 16 },
        { header: 'Target resolution', width: 16 },
        { header: 'Actual resolution', width: 16 },
        { header: 'Status', width: 12 },
      ],
      snapshot.issues.map((issue) => [
        { text: issue.description, bold: true },
        formatApprovedDate(issue.reportedDate),
        dash(issue.issueOwner),
        formatApprovedDate(issue.targetResolutionDate),
        issue.actualResolutionDate
          ? formatApprovedDate(issue.actualResolutionDate)
          : 'Open',
        issue.status,
      ]),
    );
  }

  section('Risks');
  if (snapshot.risks.length === 0) {
    writer.nothingToReport('No risks raised against this project.');
  } else {
    writer.table(
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
    );
  }

  section('Pending items');
  if (snapshot.pendingItems.length === 0) {
    writer.nothingToReport('No pending items are past their date.');
  } else {
    writer.table(
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
        row.lastFollowUp
          ? formatApprovedDate(row.lastFollowUp)
          : NOT_RECORDED,
      ]),
    );
  }

  if (isInternal) {
    section('Cost');
    if (!snapshot.cost) {
      writer.nothingToReport('No baseline budget is recorded for this project.');
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
      writer.table(
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
      );
    }

    section('Missing or incomplete data');
    if (snapshot.dataQuality.length === 0) {
      writer.nothingToReport('No missing or incomplete data flagged.');
    } else {
      writer.table(
        [
          { header: 'Type of gap', width: 30 },
          { header: 'Description', width: 70 },
        ],
        snapshot.dataQuality.map((row) => [row.flagType, row.description]),
      );
    }
  }

  writer.section('Notes');
  if (snapshot.phasesNotStarted.length === 0) {
    writer.nothingToReport('All project phases have started.');
  } else {
    writer.paragraph('Phases not yet started:');
    writer.bulletList(snapshot.phasesNotStarted.map((text) => ({ text })));
  }

  return writer.finish();
}

export async function buildMomPdf(snapshot: MomSnapshot): Promise<Buffer> {
  const writer = new ApprovedPdfWriter(snapshot.brand, {
    docType: 'MoM',
    subtitle: snapshot.projectName,
    documentRef: snapshot.control.documentRef,
  });

  writer.title(`Minutes of Meeting — ${snapshot.title}`, [
    dash(snapshot.meetingType),
    formatApprovedDateTime(snapshot.scheduledAt, snapshot.timeZone),
  ]);

  writer.controlBlock([
    ['Document reference', snapshot.control.documentRef],
    ['Version', `v${snapshot.control.version}`],
    ['Project name', snapshot.control.projectName],
    ['Organisation', dash(snapshot.organisation)],
    ['Meeting type', dash(snapshot.meetingType)],
    ['Meeting name', snapshot.title],
    ['Meeting date', formatApprovedDate(snapshot.scheduledAt)],
    ['Meeting time', formatApprovedTime(snapshot.scheduledAt, snapshot.timeZone)],
    ['Prepared by', dash(snapshot.control.preparedBy)],
  ]);

  writer.section('1. Attendance');
  writer.paragraph(
    `Organiser: ${dash(snapshot.organiser?.name)}${
      snapshot.organiser?.email ? ` (${snapshot.organiser.email})` : ''
    }${snapshot.organiser?.organisation ? ` — ${snapshot.organiser.organisation}` : ''}`,
    { bold: true },
  );
  if (snapshot.attendees.length === 0) {
    writer.nothingToReport('No attendees recorded.');
  } else {
    writer.table(
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
    );
  }

  writer.section('2. Key points discussed');
  if (snapshot.keyPoints.length === 0) {
    writer.nothingToReport('No agenda items recorded.');
  } else {
    writer.bulletList(snapshot.keyPoints.map((text) => ({ text })));
  }

  writer.section('3. Decisions');
  if (snapshot.decisions.length === 0) {
    writer.nothingToReport('No decisions recorded.');
  } else {
    writer.bulletList(snapshot.decisions.map((text) => ({ text })));
  }

  writer.section('4. Action points');
  if (snapshot.actions.length === 0) {
    writer.nothingToReport('No action points recorded.');
  } else {
    writer.table(
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
    );
  }

  writer.section('5. Acknowledgement');
  writer.paragraph(MOM_ACKNOWLEDGEMENT_NOTE);

  return writer.finish();
}
