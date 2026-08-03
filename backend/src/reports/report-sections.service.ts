import { Injectable } from '@nestjs/common';
import { PhaseStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  APPROVED_REPORT_RULES,
  daysBetween,
  milestoneRagFromVariance,
} from './templates/approved-report.rules';
import type {
  CostBlock,
  DataQualityRow,
  IssueRow,
  MilestoneRow,
  PendingItemRow,
  PhaseWorkGroup,
  RiskRow,
} from './templates/cybersec-format.types';

export type ReportPeriod = {
  start: Date;
  end: Date;
  nextStart: Date;
  nextEnd: Date;
  label: string;
};

const CLOSED_ISSUE_STATUSES = ['Closed', 'Resolved', 'Cancelled'];
const CLOSED_RISK_STATUSES = ['Closed', 'Mitigated', 'Accepted', 'Cancelled'];
const CLOSED_ACTION_STATUSES = ['Done', 'Cancelled'];

function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isWithin(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false;
  const day = startOfDay(date);
  return day >= startOfDay(start) && day <= startOfDay(end);
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** WSR covers the trailing week; MSR covers the calendar month to date. */
export function resolveReportPeriod(
  reportType: 'WSR' | 'MSR',
  now = new Date(),
): ReportPeriod {
  const end = startOfDay(now);
  if (reportType === 'WSR') {
    const start = addDays(end, -6);
    return {
      start,
      end,
      nextStart: addDays(end, 1),
      nextEnd: addDays(end, 7),
      label: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    };
  }
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const nextStart = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1),
  );
  const nextEnd = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 2, 0),
  );
  return {
    start,
    end,
    nextStart,
    nextEnd,
    label: `${start.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${start.getUTCFullYear()}`,
  };
}

/**
 * Derives the approved status report's data sections from the project record.
 * Fields with no source in the schema are returned null so the renderers can
 * print the agreed "Not recorded" line rather than omitting the field.
 */
@Injectable()
export class ReportSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildMilestonesAndPhases(
    projectId: string,
    period: ReportPeriod,
  ): Promise<{
    milestones: MilestoneRow[];
    phaseWork: PhaseWorkGroup[];
    phasesNotStarted: string[];
  }> {
    const [milestones, phases, tasks] = await Promise.all([
      this.prisma.projectMilestone.findMany({
        where: { projectId },
        orderBy: { targetDate: 'asc' },
        include: {
          phase: {
            select: { id: true, name: true, startDate: true, endDate: true },
          },
          _count: { select: { invoices: true } },
        },
      }),
      this.prisma.projectPhase.findMany({
        where: { projectId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, name: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { projectId },
        select: {
          phaseId: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          baselineEnd: true,
          actualEnd: true,
          progressApproved: true,
        },
      }),
    ]);

    const tasksByPhase = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!task.phaseId) continue;
      const bucket = tasksByPhase.get(task.phaseId) ?? [];
      bucket.push(task);
      tasksByPhase.set(task.phaseId, bucket);
    }

    const milestoneRows: MilestoneRow[] = milestones.map((milestone) => {
      const phaseTasks = milestone.phaseId
        ? (tasksByPhase.get(milestone.phaseId) ?? [])
        : [];
      const baselineDate = milestone.targetDate;

      const expectedCandidates = phaseTasks
        .map((task) => task.endDate ?? task.baselineEnd)
        .filter((date): date is Date => date != null);
      const expectedDate =
        expectedCandidates.length > 0
          ? new Date(Math.max(...expectedCandidates.map((d) => d.getTime())))
          : (milestone.phase?.endDate ?? baselineDate);

      const isComplete = ['Done', 'Completed'].includes(milestone.status);
      const percentComplete = isComplete
        ? 100
        : phaseTasks.length > 0
          ? phaseTasks.reduce(
              (sum, task) => sum + (task.progressApproved ?? 0),
              0,
            ) / phaseTasks.length
          : null;

      const varianceDays = daysBetween(baselineDate, expectedDate);
      const lengthDays = milestone.phase
        ? daysBetween(milestone.phase.startDate, milestone.phase.endDate)
        : null;

      return {
        title: milestone.title,
        status: milestone.status,
        baselineDate: iso(baselineDate),
        expectedDate: iso(expectedDate),
        varianceDays,
        percentComplete,
        ragStatus: isComplete
          ? 'green'
          : milestoneRagFromVariance(
              varianceDays,
              lengthDays,
              milestone._count.invoices > 0,
            ),
        phase: milestone.phase?.name ?? null,
      };
    });

    const phaseWork: PhaseWorkGroup[] = [];
    const phasesNotStarted: string[] = [];

    for (const phase of phases) {
      if (phase.status === PhaseStatus.Planned) {
        phasesNotStarted.push(phase.name);
        continue;
      }
      const phaseTasks = tasksByPhase.get(phase.id) ?? [];
      phaseWork.push({
        phase: phase.name,
        completed: phaseTasks
          .filter(
            (task) =>
              isWithin(task.actualEnd, period.start, period.end) ||
              (task.status === TaskStatus.Done &&
                isWithin(task.endDate, period.start, period.end)),
          )
          .map((task) => task.title),
        planned: phaseTasks
          .filter(
            (task) =>
              task.status !== TaskStatus.Done &&
              (isWithin(task.startDate, period.nextStart, period.nextEnd) ||
                isWithin(task.endDate, period.nextStart, period.nextEnd)),
          )
          .map((task) => task.title),
      });
    }

    return { milestones: milestoneRows, phaseWork, phasesNotStarted };
  }

  async buildIssues(
    projectId: string,
    period: ReportPeriod,
  ): Promise<IssueRow[]> {
    const issues = await this.prisma.issue.findMany({
      where: {
        projectId,
        OR: [
          { status: { notIn: CLOSED_ISSUE_STATUSES } },
          { updatedAt: { gte: period.start } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        dueDate: true,
        expectedResolutionDate: true,
        owner: { select: { displayName: true } },
      },
    });

    return issues.map((issue) => {
      const isClosed = CLOSED_ISSUE_STATUSES.includes(issue.status);
      return {
        description: issue.title,
        reportedDate: iso(issue.createdAt),
        // No blocking flag, action owner, or customer dependency is captured yet.
        isBlocking: null,
        blocks: null,
        actionRequired: null,
        issueOwner: issue.owner.displayName,
        actionOwner: null,
        dependency: null,
        targetResolutionDate: iso(
          issue.expectedResolutionDate ?? issue.dueDate,
        ),
        actualResolutionDate: isClosed ? iso(issue.updatedAt) : null,
        status: issue.status,
      };
    });
  }

  /**
   * Risks are written by the system: an issue left open past its target
   * resolution date, or a pending item past its date, raises one against the
   * milestone it affects. Manually entered risks are carried alongside.
   */
  async buildRisks(projectId: string, now = new Date()): Promise<RiskRow[]> {
    const [manualRisks, overdueIssues, milestones] = await Promise.all([
      this.prisma.risk.findMany({
        where: { projectId, status: { notIn: CLOSED_RISK_STATUSES } },
        orderBy: { score: 'desc' },
        select: {
          title: true,
          category: true,
          impact: true,
          likelihood: true,
          score: true,
          mitigationPlan: true,
          targetDate: true,
          status: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.prisma.issue.findMany({
        where: { projectId, status: { notIn: CLOSED_ISSUE_STATUSES } },
        select: {
          title: true,
          status: true,
          dueDate: true,
          expectedResolutionDate: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.prisma.projectMilestone.findMany({
        where: { projectId },
        orderBy: { targetDate: 'asc' },
        select: { title: true, targetDate: true },
      }),
    ]);

    const rows: RiskRow[] = manualRisks.map((risk) => ({
      description:
        risk.title?.trim() ||
        risk.mitigationPlan?.trim() ||
        `${risk.category} exposure (impact ${risk.impact}, likelihood ${risk.likelihood})`,
      category: risk.category,
      owner: risk.owner.displayName,
      affectedMilestone: null,
      source: 'manual',
      exposure: 'internal',
      targetDate: iso(risk.targetDate),
      status: risk.status,
      score: risk.score,
    }));

    const today = startOfDay(now);
    for (const issue of overdueIssues) {
      const target = issue.expectedResolutionDate ?? issue.dueDate;
      if (!target) continue;
      const daysOverdue = daysBetween(target, today);
      // Blocking is not captured, so the standard waiting period applies.
      if (daysOverdue < APPROVED_REPORT_RULES.riskFromOverdueIssueDays.standard) {
        continue;
      }
      const affected = milestones.find(
        (milestone) => startOfDay(milestone.targetDate) >= startOfDay(target),
      );
      rows.push({
        description: `Issue unresolved ${daysOverdue} days past its target resolution date: ${issue.title}`,
        category: 'Schedule',
        owner: issue.owner.displayName,
        affectedMilestone: affected?.title ?? null,
        source: 'system',
        // Without a recorded party, a delay is treated as ours and stays internal.
        exposure: 'internal',
        targetDate: iso(target),
        status: 'Open',
        score: null,
      });
    }

    return rows;
  }

  /** Anything past its date, whatever it started life as. */
  async buildPendingItems(
    projectId: string,
    now = new Date(),
  ): Promise<PendingItemRow[]> {
    const today = startOfDay(now);
    const [issues, risks, actions, tasks] = await Promise.all([
      this.prisma.issue.findMany({
        where: {
          projectId,
          status: { notIn: CLOSED_ISSUE_STATUSES },
          dueDate: { lt: today },
        },
        select: {
          title: true,
          dueDate: true,
          expectedResolutionDate: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.prisma.risk.findMany({
        where: {
          projectId,
          status: { notIn: CLOSED_RISK_STATUSES },
          targetDate: { lt: today },
        },
        select: {
          title: true,
          category: true,
          mitigationPlan: true,
          targetDate: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.prisma.actionPoint.findMany({
        where: {
          projectId,
          status: { notIn: CLOSED_ACTION_STATUSES },
          dueDate: { lt: today },
        },
        select: {
          title: true,
          dueDate: true,
          owner: { select: { displayName: true } },
        },
      }),
      this.prisma.task.findMany({
        where: {
          projectId,
          status: { not: TaskStatus.Done },
          endDate: { lt: today },
        },
        select: {
          title: true,
          endDate: true,
          owner: { select: { displayName: true } },
          phase: { select: { name: true } },
          progressUpdates: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
    ]);

    const rows: PendingItemRow[] = [];

    for (const issue of issues) {
      const requested = issue.expectedResolutionDate ?? issue.dueDate;
      rows.push({
        item: issue.title,
        type: 'Issue',
        requestedDate: iso(requested),
        daysWaiting: daysBetween(requested, today),
        owner: issue.owner.displayName,
        sittingWith: null,
        holdingUp: null,
        lastFollowUp: null,
      });
    }

    for (const risk of risks) {
      if (!risk.targetDate) continue;
      rows.push({
        item: risk.title?.trim() || risk.mitigationPlan?.trim() || `${risk.category} risk`,
        type: 'Risk',
        requestedDate: iso(risk.targetDate),
        daysWaiting: daysBetween(risk.targetDate, today),
        owner: risk.owner.displayName,
        sittingWith: null,
        holdingUp: null,
        lastFollowUp: null,
      });
    }

    for (const action of actions) {
      rows.push({
        item: action.title,
        type: 'Action',
        requestedDate: iso(action.dueDate),
        daysWaiting: daysBetween(action.dueDate, today),
        owner: action.owner.displayName,
        sittingWith: null,
        holdingUp: null,
        lastFollowUp: null,
      });
    }

    for (const task of tasks) {
      if (!task.endDate) continue;
      rows.push({
        item: task.title,
        type: 'Task',
        requestedDate: iso(task.endDate),
        daysWaiting: daysBetween(task.endDate, today),
        owner: task.owner?.displayName ?? null,
        sittingWith: null,
        holdingUp: task.phase?.name ?? null,
        lastFollowUp: iso(task.progressUpdates[0]?.createdAt ?? null),
      });
    }

    return rows.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  }

  /** Internal audience only. Actual effort comes from consultant timesheets. */
  async buildCost(projectId: string): Promise<CostBlock | null> {
    const [budget, lineItems, employeeCost, timesheets, project] =
      await Promise.all([
        this.prisma.projectBudget.findUnique({
          where: { projectId },
          select: { baselineAmount: true, currency: true },
        }),
        this.prisma.budgetLineItem.aggregate({
          where: { budget: { projectId } },
          _sum: { planned: true, actual: true },
        }),
        this.prisma.employeeCost.aggregate({
          where: { projectId },
          _sum: { totalCost: true },
        }),
        this.prisma.timesheet.aggregate({
          where: { projectId },
          _sum: { regularHours: true, overtimeHours: true },
        }),
        this.prisma.project.findUnique({
          where: { id: projectId },
          select: { value: true, currency: true },
        }),
      ]);

    const baselineAmount =
      Number(budget?.baselineAmount ?? 0) ||
      Number(lineItems._sum.planned ?? 0) ||
      Number(project?.value ?? 0) ||
      null;

    const employeeSpend = Number(employeeCost._sum.totalCost ?? 0);
    const lineItemSpend = Number(lineItems._sum.actual ?? 0);
    const actualAmount = employeeSpend || lineItemSpend || null;

    const effortHours =
      Number(timesheets._sum.regularHours ?? 0) +
      Number(timesheets._sum.overtimeHours ?? 0);

    if (baselineAmount == null && actualAmount == null && effortHours === 0) {
      return null;
    }

    return {
      currency: budget?.currency ?? project?.currency ?? 'USD',
      baselineAmount,
      actualAmount,
      varianceAmount:
        baselineAmount != null && actualAmount != null
          ? baselineAmount - actualAmount
          : null,
      actualEffortHours: effortHours || null,
    };
  }

  /** Internal audience only. Severity is deliberately not carried. */
  async buildDataQuality(projectId: string): Promise<DataQualityRow[]> {
    const flags = await this.prisma.dataQualityFlag.findMany({
      where: { projectId, isResolved: false },
      orderBy: { flaggedAt: 'desc' },
      select: { flagType: true, description: true },
    });
    return flags.map((flag) => ({
      flagType: flag.flagType,
      description: flag.description,
    }));
  }
}
