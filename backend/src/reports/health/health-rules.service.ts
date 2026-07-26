import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CaslUserContext } from '../../casl/casl.types';
import { RecordScopeWhereService } from '../../casl/record-scope-where.service';
import {
  DEFAULT_HEALTH_RULES,
  HEALTH_RULE_VERSION,
  HealthDimension,
  RagStatus,
  overallRag,
  scoreToRag,
} from './health-rules.constants';
import {
  ProjectHealthEvaluationDto,
  UpdateHealthRuleItemDto,
} from '../dto/health-rules.dto';

type RuleRow = {
  dimension: string;
  greenThreshold: Prisma.Decimal;
  amberThreshold: Prisma.Decimal;
  redThreshold: Prisma.Decimal | null;
  version: string;
  unit: string | null;
};

@Injectable()
export class HealthRulesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultRules();
  }

  async ensureDefaultRules() {
    const admin = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!admin) return;

    for (const rule of DEFAULT_HEALTH_RULES) {
      const existing = await this.prisma.healthRuleConfig.findFirst({
        where: { dimension: rule.dimension, isActive: true },
      });
      if (existing) continue;
      await this.prisma.healthRuleConfig.create({
        data: {
          dimension: rule.dimension,
          greenThreshold: rule.greenThreshold,
          amberThreshold: rule.amberThreshold,
          redThreshold: rule.redThreshold,
          unit: rule.unit,
          version: HEALTH_RULE_VERSION,
          isActive: true,
          updatedBy: admin.id,
        },
      });
    }
  }

  async listRules() {
    const rows = await this.prisma.healthRuleConfig.findMany({
      where: { isActive: true },
      orderBy: { dimension: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      dimension: row.dimension,
      greenThreshold: Number(row.greenThreshold),
      amberThreshold: Number(row.amberThreshold),
      redThreshold: row.redThreshold == null ? null : Number(row.redThreshold),
      unit: row.unit,
      version: row.version,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    }));
  }

  async updateRules(items: UpdateHealthRuleItemDto[], userId: string) {
    for (const item of items) {
      const active = await this.prisma.healthRuleConfig.findFirst({
        where: { dimension: item.dimension, isActive: true },
      });
      if (active) {
        await this.prisma.healthRuleConfig.update({
          where: { id: active.id },
          data: { isActive: false },
        });
      }
      await this.prisma.healthRuleConfig.create({
        data: {
          dimension: item.dimension,
          greenThreshold: item.greenThreshold,
          amberThreshold: item.amberThreshold,
          redThreshold: item.redThreshold ?? null,
          unit: item.unit ?? '%',
          version: HEALTH_RULE_VERSION,
          isActive: item.isActive ?? true,
          updatedBy: userId,
        },
      });
    }
    return this.listRules();
  }

  private async activeRules(): Promise<Map<string, RuleRow>> {
    const rows = await this.prisma.healthRuleConfig.findMany({
      where: { isActive: true },
    });
    return new Map(rows.map((row) => [row.dimension, row]));
  }

  async evaluateProject(
    projectId: string,
    caslUser?: CaslUserContext,
  ): Promise<ProjectHealthEvaluationDto> {
    if (caslUser) {
      const scope = this.recordScopeWhere.projectWhere(caslUser, 'read');
      const allowed = await this.prisma.project.findFirst({
        where: { AND: [{ id: projectId }, scope] },
        select: { id: true },
      });
      if (!allowed) {
        throw new NotFoundException('Project not found');
      }
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
        value: true,
        endDate: true,
        _count: { select: { milestones: true, tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const rules = await this.activeRules();
    const now = new Date();

    const [
      tasks,
      doneMilestones,
      employeeCosts,
      budgetActual,
      invoices,
      allocations,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId, parentTaskId: null },
        select: {
          status: true,
          priority: true,
          endDate: true,
          progressApproved: true,
        },
      }),
      this.prisma.projectMilestone.count({
        where: {
          projectId,
          status: { in: ['Done', 'Completed'] },
        },
      }),
      this.prisma.employeeCost.aggregate({
        where: { projectId },
        _sum: { totalCost: true },
      }),
      this.prisma.budgetLineItem.aggregate({
        where: { budget: { projectId } },
        _sum: { actual: true, planned: true },
      }),
      this.prisma.invoice.findMany({
        where: { projectId },
        select: { amount: true, collectionDate: true, status: true },
      }),
      this.prisma.allocation.findMany({
        where: { projectId },
        select: { percent: true },
      }),
    ]);

    const scheduleScore = this.computeScheduleScore(
      project.status,
      project.endDate,
      tasks,
      project._count.milestones,
      doneMilestones,
      now,
    );
    const costScore = this.computeCostScore(
      Number(project.value ?? 0),
      Number(employeeCosts._sum.totalCost ?? 0) / 1000,
      Number(budgetActual._sum.actual ?? 0) / 1000,
      Number(budgetActual._sum.planned ?? 0) / 1000,
    );
    const riskScore = this.computeRiskScore(tasks);
    const resourcesScore = this.computeResourcesScore(allocations);
    const collectionsScore = this.computeCollectionsScore(invoices);

    const scores: Record<HealthDimension, { score: number; value: Record<string, unknown> }> = {
      schedule: {
        score: scheduleScore.score,
        value: scheduleScore.value,
      },
      cost: { score: costScore.score, value: costScore.value },
      risk: { score: riskScore.score, value: riskScore.value },
      resources: {
        score: resourcesScore.score,
        value: resourcesScore.value,
      },
      collections: {
        score: collectionsScore.score,
        value: collectionsScore.value,
      },
    };

    const dimensions = (Object.keys(scores) as HealthDimension[]).map(
      (dimension) => {
        const rule = rules.get(dimension);
        const green = rule ? Number(rule.greenThreshold) : 85;
        const amber = rule ? Number(rule.amberThreshold) : 60;
        const red = rule?.redThreshold == null ? 0 : Number(rule.redThreshold);
        const ragStatus = scoreToRag(scores[dimension].score, green, amber, red);
        return {
          dimension,
          score: scores[dimension].score,
          ragStatus,
          value: scores[dimension].value,
          ruleVersion: rule?.version ?? HEALTH_RULE_VERSION,
        };
      },
    );

    return {
      projectId: project.id,
      projectName: project.name,
      overallRag: overallRag(dimensions.map((d) => d.ragStatus as RagStatus)),
      dimensions,
      evaluatedAt: now.toISOString(),
      source: 'live',
    };
  }

  async evaluateScopedProjects(caslUser: CaslUserContext) {
    const scope = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const projects = await this.prisma.project.findMany({
      where: scope,
      select: { id: true },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });
    const results: ProjectHealthEvaluationDto[] = [];
    for (const project of projects) {
      results.push(await this.evaluateProject(project.id));
    }
    return results;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async captureNightlySnapshots() {
    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.Active, ProjectStatus.At_Risk] },
      },
      select: { id: true },
      take: 200,
    });
    const today = new Date();
    const periodStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    for (const project of projects) {
      try {
        const evaluation = await this.evaluateProject(project.id);
        for (const dim of evaluation.dimensions) {
          await this.prisma.kpiSnapshot.create({
            data: {
              projectId: project.id,
              kpiFamily: dim.dimension,
              value: dim.value as Prisma.InputJsonValue,
              ragStatus: dim.ragStatus,
              ruleVersion: dim.ruleVersion,
              periodStart,
              periodEnd: periodStart,
            },
          });
        }
      } catch {
        // skip project on evaluation failure
      }
    }
  }

  async getRecentSnapshots(projectId: string, kpiFamily: string, limit = 7) {
    return this.prisma.kpiSnapshot.findMany({
      where: { projectId, kpiFamily },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    });
  }

  private computeScheduleScore(
    status: ProjectStatus,
    plannedEndDate: Date | null,
    tasks: Array<{
      status: TaskStatus;
      endDate: Date | null;
      progressApproved: number | null;
    }>,
    milestonesTotal: number,
    milestonesDone: number,
    now: Date,
  ) {
    if (status === ProjectStatus.Closed) {
      return { score: 100, value: { status, reason: 'closed' } };
    }
    const overdueTasks = tasks.filter(
      (t) =>
        t.endDate &&
        t.endDate < now &&
        t.status !== TaskStatus.Done,
    ).length;
    const avgProgress =
      tasks.length > 0
        ? tasks.reduce((sum, t) => sum + (t.progressApproved ?? 0), 0) /
          tasks.length
        : 0;
    const milestonePct =
      milestonesTotal > 0 ? (milestonesDone / milestonesTotal) * 100 : avgProgress;
    let score = Math.round(milestonePct * 0.6 + avgProgress * 0.4);
    if (overdueTasks > 0) {
      score = Math.max(0, score - Math.min(40, overdueTasks * 8));
    }
    if (plannedEndDate && plannedEndDate < now) {
      score = Math.min(score, 45);
    }
    if (status === ProjectStatus.At_Risk) score = Math.min(score, 55);
    if (status === ProjectStatus.On_Hold) score = Math.min(score, 40);
    return {
      score,
      value: {
        avgProgress: Math.round(avgProgress),
        milestonePct: Math.round(milestonePct),
        overdueTasks,
        milestonesDone,
        milestonesTotal,
      },
    };
  }

  private computeCostScore(
    projectValue: number,
    employeeSpend: number,
    lineItemSpend: number,
    planned: number,
  ) {
    const spent = employeeSpend > 0 ? employeeSpend : lineItemSpend;
    const budgetBase = planned > 0 ? planned : projectValue;
    if (budgetBase <= 0) {
      return { score: 100, value: { spent, budgetBase, adherence: null } };
    }
    const adherence = Math.round((spent / budgetBase) * 100);
    // Under/at budget is healthier; over budget lowers score
    const score =
      adherence <= 100
        ? Math.max(60, 100 - Math.abs(100 - adherence) * 0.2)
        : Math.max(0, 100 - (adherence - 100));
    return {
      score: Math.round(score),
      value: { spent, budgetBase, adherence },
    };
  }

  private computeRiskScore(
    tasks: Array<{ priority: string | null; status: TaskStatus }>,
  ) {
    const openHigh = tasks.filter(
      (t) =>
        (t.priority === 'High' || t.priority === 'Critical') &&
        t.status !== TaskStatus.Done,
    ).length;
    const score = Math.max(0, 100 - openHigh * 15);
    return { score, value: { openHighCriticalTasks: openHigh } };
  }

  private computeResourcesScore(
    allocations: Array<{ percent: Prisma.Decimal | number | null }>,
  ) {
    if (allocations.length === 0) {
      return { score: 70, value: { allocationCount: 0, avgPct: null } };
    }
    const avg =
      allocations.reduce((sum, a) => sum + Number(a.percent ?? 0), 0) /
      allocations.length;
    let score = 100;
    if (avg > 120) score = Math.max(0, 100 - (avg - 120));
    else if (avg < 40) score = Math.max(0, 50 + avg);
    return {
      score: Math.round(score),
      value: { allocationCount: allocations.length, avgPct: Math.round(avg) },
    };
  }

  private computeCollectionsScore(
    invoices: Array<{
      amount: Prisma.Decimal | number;
      collectionDate: Date | null;
      status: string;
    }>,
  ) {
    if (invoices.length === 0) {
      return { score: 100, value: { invoiceCount: 0, collectedPct: null } };
    }
    const total = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const collected = invoices
      .filter(
        (inv) =>
          inv.collectionDate != null ||
          inv.status?.toLowerCase() === 'paid' ||
          inv.status?.toLowerCase() === 'collected',
      )
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const collectedPct = total > 0 ? Math.round((collected / total) * 100) : 0;
    return {
      score: collectedPct,
      value: { invoiceCount: invoices.length, collectedPct, total, collected },
    };
  }
}
