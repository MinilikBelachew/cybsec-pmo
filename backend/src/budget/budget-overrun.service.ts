import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AlertEngineService } from '../alerts/alert-engine.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { RoleEnum } from '../roles/roles.enum';
import {
  DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT,
  DEFAULT_BUDGET_WARNING_THRESHOLD_PCT,
} from './budget.constants';
import { computeBudgetAmounts, decimalToNumber, sumDecimals } from './budget-calc.util';
import { BUDGET_LINE_CATEGORY, BUDGET_REVISION_STATUS } from './budget.constants';

@Injectable()
export class BudgetOverrunService {
  private readonly logger = new Logger(BudgetOverrunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  /**
   * Ensure catalogue rules exist, then fire warning/overrun when adherence %
   * (actual / expected * 100) crosses configured thresholds.
   */
  async evaluateProject(projectId: string, actorId?: string): Promise<void> {
    try {
      await this.ensureDefaultRules();
      const summary = await this.computeSummary(projectId);
      if (!summary || summary.expectedCost <= 0) return;

      const adherencePct = Math.round(
        (summary.actualCost / summary.expectedCost) * 10000,
      ) / 100;

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      const projectName = project?.name ?? 'Project';

      if (adherencePct >= DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT) {
        await this.alertEngine.fire({
          eventType: NOTIFICATION_EVENT_TYPE.BUDGET_OVERRUN,
          objectType: 'ProjectBudget',
          objectId: summary.budgetId ?? projectId,
          title: 'Budget overrun',
          body: `${projectName} spend is at ${adherencePct}% of expected budget.`,
          payload: {
            projectId,
            adherencePct,
            expectedCost: summary.expectedCost,
            actualCost: summary.actualCost,
            link: `/dashboard/projects/${projectId}?view=financials`,
          },
          actorId,
          metricValue: adherencePct,
        });
      } else if (adherencePct >= DEFAULT_BUDGET_WARNING_THRESHOLD_PCT) {
        await this.alertEngine.fire({
          eventType: NOTIFICATION_EVENT_TYPE.BUDGET_THRESHOLD_WARNING,
          objectType: 'ProjectBudget',
          objectId: summary.budgetId ?? projectId,
          title: 'Budget threshold warning',
          body: `${projectName} spend is at ${adherencePct}% of expected budget.`,
          payload: {
            projectId,
            adherencePct,
            expectedCost: summary.expectedCost,
            actualCost: summary.actualCost,
            link: `/dashboard/projects/${projectId}?view=financials`,
          },
          actorId,
          metricValue: adherencePct,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Budget overrun evaluation failed for ${projectId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async computeSummary(projectId: string) {
    const [project, budget, employeeAgg, invoiceAgg] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { value: true },
      }),
      this.prisma.projectBudget.findUnique({
        where: { projectId },
        include: {
          revisions: {
            where: { status: BUDGET_REVISION_STATUS.APPROVED },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          lineItems: true,
        },
      }),
      this.prisma.employeeCost.aggregate({
        where: { projectId },
        _sum: { totalCost: true },
      }),
      this.prisma.invoice.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
    ]);

    if (!project) return null;

    const lineItems = budget?.lineItems ?? [];
    const amounts = computeBudgetAmounts({
      baselineAmount: decimalToNumber(budget?.baselineAmount),
      approvedRevisionAmount: decimalToNumber(
        budget?.revisions[0]?.revisedAmount,
      ),
      plannedLineTotal: sumDecimals(lineItems.map((l) => l.planned)),
      employeeCostTotal: decimalToNumber(employeeAgg._sum.totalCost) ?? 0,
      lineItemActualTotal: sumDecimals(lineItems.map((l) => l.actual)),
      otherActualTotal: sumDecimals(
        lineItems
          .filter((l) => l.category !== BUDGET_LINE_CATEGORY.RESOURCE)
          .map((l) => l.actual),
      ),
      projectValue: decimalToNumber(project.value),
      invoiceTotal: decimalToNumber(invoiceAgg._sum.amount) ?? 0,
    });

    return {
      budgetId: budget?.id ?? null,
      expectedCost: amounts.expectedCost,
      actualCost: amounts.actualCost,
    };
  }

  private async ensureDefaultRules(): Promise<void> {
    const existing = await this.prisma.alertRule.findMany({
      where: {
        eventType: {
          in: [
            NOTIFICATION_EVENT_TYPE.BUDGET_OVERRUN,
            NOTIFICATION_EVENT_TYPE.BUDGET_THRESHOLD_WARNING,
          ],
        },
      },
      select: { eventType: true },
    });
    const have = new Set(existing.map((r) => r.eventType));

    const financeRole = await this.prisma.role.findFirst({
      where: { code: RoleEnum.finance },
      select: { id: true },
    });
    const pmoRole = await this.prisma.role.findFirst({
      where: { code: RoleEnum.pmo_lead },
      select: { id: true },
    });
    const recipientRoleIds = [financeRole?.id, pmoRole?.id].filter(
      (id): id is number => id != null,
    );

    const defs = [
      {
        eventType: NOTIFICATION_EVENT_TYPE.BUDGET_OVERRUN,
        thresholdConfig: { scoreGte: DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT },
      },
      {
        eventType: NOTIFICATION_EVENT_TYPE.BUDGET_THRESHOLD_WARNING,
        thresholdConfig: { scoreGte: DEFAULT_BUDGET_WARNING_THRESHOLD_PCT },
      },
    ] as const;

    for (const def of defs) {
      if (have.has(def.eventType)) continue;
      await this.prisma.alertRule.create({
        data: {
          eventType: def.eventType,
          thresholdConfig: def.thresholdConfig,
          channels: ['in_app', 'email'],
          reminderCadenceHrs: 24,
          escalationDelayHrs: 48,
          escalationRole: RoleEnum.pmo_lead,
          isActive: true,
          recipients:
            recipientRoleIds.length > 0
              ? {
                  create: recipientRoleIds.map((roleId) => ({ roleId })),
                }
              : undefined,
        },
      });
    }
  }
}
