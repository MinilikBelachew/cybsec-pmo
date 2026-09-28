import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AlertEngineService } from '../../alerts/alert-engine.service';
import { NOTIFICATION_EVENT_TYPE } from '../../notifications/notifications.constants';
import { RoleEnum } from '../../roles/roles.enum';
import { KEKA_SYNC_STATUS } from '../../integrations/keka/keka.constants';
import { TIMESHEET_STATUS } from '../../timesheets/timesheets.constants';
import {
  COST_ANOMALY_LOOKBACK_MONTHS,
  COST_ANOMALY_OT_SPIKE_MIN_HOURS,
  COST_ANOMALY_OT_SPIKE_RATIO,
  COST_ANOMALY_RATE_JUMP_PCT,
  DATA_QUALITY_FLAG_TYPE,
  DATA_QUALITY_SEVERITY,
  DataQualityFlagType,
  KEKA_INTEGRATION_FLAG_ID,
} from './data-quality.constants';

type FlagCandidate = {
  flagType: DataQualityFlagType;
  objectType: string;
  objectId: string;
  projectId: string | null;
  severity: string;
  description: string;
};

export type DataQualityRules = {
  includeFlagTypes?: DataQualityFlagType[];
  excludeFlagTypes?: DataQualityFlagType[];
  enabled?: Partial<Record<DataQualityFlagType, boolean>>;
};

const COST_ANOMALY_FLAG_TYPES = new Set<DataQualityFlagType>([
  DATA_QUALITY_FLAG_TYPE.COST_MISSING_RATE,
  DATA_QUALITY_FLAG_TYPE.COST_RATE_JUMP,
  DATA_QUALITY_FLAG_TYPE.COST_OT_SPIKE,
]);

@Injectable()
export class DataQualityService {
  private readonly logger = new Logger(DataQualityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  scanAll() {
    return this.scan();
  }

  scanProject(projectId: string) {
    return this.scan(projectId);
  }

  async listFlags(query: {
    resolved?: boolean | string;
    projectId?: string;
    flagType?: string;
    page?: number;
    limit?: number;
  }) {
    const resolved =
      query.resolved === undefined
        ? undefined
        : query.resolved === true || query.resolved === 'true';
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const where = {
      ...(resolved === undefined ? {} : { isResolved: resolved }),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.flagType ? { flagType: query.flagType } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.dataQualityFlag.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ isResolved: 'asc' }, { flaggedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dataQualityFlag.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async resolveFlag(id: string, userId: string) {
    const flag = await this.prisma.dataQualityFlag.findUnique({
      where: { id },
    });
    if (!flag) throw new NotFoundException('Data quality flag not found');
    return this.prisma.dataQualityFlag.update({
      where: { id },
      data: { isResolved: true, resolvedBy: userId, resolvedAt: new Date() },
    });
  }

  async getRules(): Promise<DataQualityRules> {
    const settings = await this.prisma.appSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: { dataQualityRules: true },
    });
    return this.parseRules(settings.dataQualityRules);
  }

  async updateRules(rules: DataQualityRules, userId: string) {
    const normalized = this.normalizeRules(rules);
    await this.prisma.appSetting.upsert({
      where: { id: 'default' },
      update: {
        dataQualityRules: normalized as Prisma.InputJsonValue,
        updatedById: userId,
      },
      create: {
        id: 'default',
        dataQualityRules: normalized as Prisma.InputJsonValue,
        updatedById: userId,
      },
    });
    return normalized;
  }

  private async scan(projectId?: string) {
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - day + 1);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const [allocations, submitted, projects, lastSuccess, firstLog] =
      await Promise.all([
        this.prisma.allocation.findMany({
          where: {
            ...(projectId ? { projectId } : {}),
            status: 'Active',
            startDate: { lt: weekEnd },
            OR: [{ endDate: null }, { endDate: { gte: weekStart } }],
            employee: { isActive: true },
          },
          select: {
            employeeId: true,
            projectId: true,
            employee: { select: { name: true } },
            project: { select: { name: true } },
          },
        }),
        this.prisma.timesheet.findMany({
          where: {
            ...(projectId ? { projectId } : {}),
            status: TIMESHEET_STATUS.SUBMITTED,
            workDate: { gte: weekStart, lt: weekEnd },
          },
          select: {
            id: true,
            projectId: true,
            employee: { select: { name: true } },
            workDate: true,
          },
        }),
        this.prisma.project.findMany({
          where: {
            ...(projectId ? { id: projectId } : {}),
            status: 'Active',
          },
          select: {
            id: true,
            name: true,
            updatedAt: true,
            tasks: { select: { progressApproved: true } },
            _count: { select: { milestones: true } },
          },
        }),
        projectId
          ? Promise.resolve(null)
          : this.prisma.kekaSyncLog.findFirst({
              where: { status: KEKA_SYNC_STATUS.SUCCESS },
              orderBy: { createdAt: 'desc' },
              select: { id: true, createdAt: true },
            }),
        projectId
          ? Promise.resolve(null)
          : this.prisma.kekaSyncLog.findFirst({
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            }),
      ]);

    const candidates: FlagCandidate[] = [];
    for (const allocation of allocations) {
      const usable = await this.prisma.timesheet.count({
        where: {
          employeeId: allocation.employeeId,
          projectId: allocation.projectId,
          workDate: { gte: weekStart, lt: weekEnd },
          status: { not: TIMESHEET_STATUS.DRAFT },
        },
      });
      if (usable === 0) {
        candidates.push({
          flagType: DATA_QUALITY_FLAG_TYPE.MISSING_TIMESHEET,
          objectType: 'Employee',
          objectId: allocation.employeeId,
          projectId: allocation.projectId,
          severity: DATA_QUALITY_SEVERITY.HIGH,
          description: `${allocation.employee.name} has no submitted timesheet for ${allocation.project.name} this week`,
        });
      }
    }

    for (const timesheet of submitted) {
      candidates.push({
        flagType: DATA_QUALITY_FLAG_TYPE.UNAPPROVED_TIMESHEET,
        objectType: 'Timesheet',
        objectId: timesheet.id,
        projectId: timesheet.projectId,
        severity: DATA_QUALITY_SEVERITY.MEDIUM,
        description: `${timesheet.employee.name}'s timesheet for ${timesheet.workDate.toISOString().slice(0, 10)} is awaiting approval`,
      });
    }

    const staleCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    if (!projectId && (!lastSuccess || lastSuccess.createdAt < staleCutoff)) {
      candidates.push({
        flagType: DATA_QUALITY_FLAG_TYPE.STALE_INTEGRATION,
        objectType: 'Integration',
        objectId: firstLog?.id ?? KEKA_INTEGRATION_FLAG_ID,
        projectId: null,
        severity: DATA_QUALITY_SEVERITY.CRITICAL,
        description: lastSuccess
          ? `Keka last synchronized successfully at ${lastSuccess.createdAt.toISOString()}`
          : 'Keka has no successful synchronization record',
      });
    }

    const staleProjectCutoff = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    );
    for (const project of projects) {
      const progress =
        project.tasks.length === 0
          ? 0
          : project.tasks.reduce(
              (sum, task) => sum + task.progressApproved,
              0,
            ) / project.tasks.length;
      if (
        project._count.milestones === 0 ||
        (project.updatedAt < staleProjectCutoff && progress === 0)
      ) {
        candidates.push({
          flagType: DATA_QUALITY_FLAG_TYPE.INCOMPLETE_PROJECT,
          objectType: 'Project',
          objectId: project.id,
          projectId: project.id,
          severity: DATA_QUALITY_SEVERITY.HIGH,
          description:
            project._count.milestones === 0
              ? `${project.name} has no milestones`
              : `${project.name} has zero progress and has not been updated in 14 days`,
        });
      }
    }

    candidates.push(...(await this.collectCostAnomalies(projectId, now)));

    const rules = await this.getRules();
    const enabledCandidates = candidates.filter((candidate) =>
      this.isEnabled(candidate.flagType, rules),
    );
    const previouslyOpenCostKeys = new Set(
      (
        await this.prisma.dataQualityFlag.findMany({
          where: {
            isResolved: false,
            flagType: { in: [...COST_ANOMALY_FLAG_TYPES] },
            ...(projectId ? { projectId } : {}),
          },
          select: { flagType: true, objectId: true, projectId: true },
        })
      ).map((f) => `${f.flagType}:${f.objectId}:${f.projectId ?? ''}`),
    );
    await this.persistCandidates(enabledCandidates, projectId);
    await this.notifyNewCostAnomalies(enabledCandidates, previouslyOpenCostKeys);

    return this.listFlags({
      resolved: false,
      ...(projectId ? { projectId } : {}),
    });
  }

  /**
   * M5.2-05 / UC-15 — zero rates, rate jumps, OT spikes on EmployeeCost periods.
   */
  private async collectCostAnomalies(
    projectId: string | undefined,
    now: Date,
  ): Promise<FlagCandidate[]> {
    const lookbackStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - COST_ANOMALY_LOOKBACK_MONTHS, 1),
    );
    const lookbackYear = lookbackStart.getUTCFullYear();
    const lookbackMonth = lookbackStart.getUTCMonth() + 1;

    const costs = await this.prisma.employeeCost.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        OR: [
          { periodYear: { gt: lookbackYear } },
          {
            periodYear: lookbackYear,
            periodMonth: { gte: lookbackMonth },
          },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        projectId: true,
        periodYear: true,
        periodMonth: true,
        ratePerHour: true,
        regularHours: true,
        overtimeHours: true,
        employee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [
        { employeeId: 'asc' },
        { projectId: 'asc' },
        { periodYear: 'asc' },
        { periodMonth: 'asc' },
      ],
    });

    const candidates: FlagCandidate[] = [];
    const priorRate = new Map<string, number>();

    for (const cost of costs) {
      const rate = Number(cost.ratePerHour);
      const regular = Number(cost.regularHours);
      const overtime = Number(cost.overtimeHours);
      const totalHours = regular + overtime;
      const periodLabel = `${cost.periodYear}-${String(cost.periodMonth).padStart(2, '0')}`;
      const seriesKey = `${cost.employeeId}:${cost.projectId}`;

      if (totalHours > 0 && (!Number.isFinite(rate) || rate <= 0)) {
        candidates.push({
          flagType: DATA_QUALITY_FLAG_TYPE.COST_MISSING_RATE,
          objectType: 'EmployeeCost',
          objectId: cost.id,
          projectId: cost.projectId,
          severity: DATA_QUALITY_SEVERITY.CRITICAL,
          description: `${cost.employee.name} on ${cost.project.name} (${periodLabel}) has ${totalHours}h approved but rate Per Hour is zero/missing`,
        });
      }

      const previous = priorRate.get(seriesKey);
      if (
        previous != null &&
        previous > 0 &&
        Number.isFinite(rate) &&
        rate > 0
      ) {
        const jumpPct = ((rate - previous) / previous) * 100;
        if (jumpPct >= COST_ANOMALY_RATE_JUMP_PCT) {
          candidates.push({
            flagType: DATA_QUALITY_FLAG_TYPE.COST_RATE_JUMP,
            objectType: 'EmployeeCost',
            objectId: cost.id,
            projectId: cost.projectId,
            severity: DATA_QUALITY_SEVERITY.HIGH,
            description: `${cost.employee.name} on ${cost.project.name} (${periodLabel}) rate jumped ${jumpPct.toFixed(0)}% (${previous} → ${rate})`,
          });
        }
      }
      if (Number.isFinite(rate) && rate > 0) {
        priorRate.set(seriesKey, rate);
      }

      const otSpikeByRatio =
        regular > 0 && overtime / regular >= COST_ANOMALY_OT_SPIKE_RATIO;
      const otSpikeAbsolute =
        regular <= 0 && overtime >= COST_ANOMALY_OT_SPIKE_MIN_HOURS;
      if (otSpikeByRatio || otSpikeAbsolute) {
        const ratioLabel =
          regular > 0
            ? `${((overtime / regular) * 100).toFixed(0)}% of regular`
            : `${overtime}h OT with no regular hours`;
        candidates.push({
          flagType: DATA_QUALITY_FLAG_TYPE.COST_OT_SPIKE,
          objectType: 'EmployeeCost',
          objectId: cost.id,
          projectId: cost.projectId,
          severity: DATA_QUALITY_SEVERITY.HIGH,
          description: `${cost.employee.name} on ${cost.project.name} (${periodLabel}) OT spike: ${overtime}h OT / ${regular}h regular (${ratioLabel})`,
        });
      }
    }

    return candidates;
  }

  private async notifyNewCostAnomalies(
    candidates: FlagCandidate[],
    previouslyOpenKeys: Set<string>,
  ) {
    const anomalies = candidates.filter((c) => {
      if (!COST_ANOMALY_FLAG_TYPES.has(c.flagType)) return false;
      const key = `${c.flagType}:${c.objectId}:${c.projectId ?? ''}`;
      return !previouslyOpenKeys.has(key);
    });
    if (anomalies.length === 0) return;

    try {
      await this.ensureCostAnomalyAlertRule();

      for (const anomaly of anomalies) {
        await this.alertEngine.fire({
          eventType: NOTIFICATION_EVENT_TYPE.COST_ANOMALY_DETECTED,
          objectType: anomaly.objectType,
          objectId: anomaly.objectId,
          title: 'Cost anomaly detected',
          body: anomaly.description,
          payload: {
            projectId: anomaly.projectId,
            flagType: anomaly.flagType,
            severity: anomaly.severity,
            link: '/dashboard/reports/data-quality',
          },
          metricValue:
            anomaly.severity === DATA_QUALITY_SEVERITY.CRITICAL ? 100 : 75,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Cost anomaly alerts failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async ensureCostAnomalyAlertRule(): Promise<void> {
    const existing = await this.prisma.alertRule.findFirst({
      where: { eventType: NOTIFICATION_EVENT_TYPE.COST_ANOMALY_DETECTED },
      select: { id: true },
    });
    if (existing) return;

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

    await this.prisma.alertRule.create({
      data: {
        eventType: NOTIFICATION_EVENT_TYPE.COST_ANOMALY_DETECTED,
        thresholdConfig: { scoreGte: 50 },
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

  private async persistCandidates(
    candidates: FlagCandidate[],
    projectId?: string,
  ) {
    candidates = [
      ...new Map(
        candidates.map((candidate) => [
          `${candidate.flagType}:${candidate.objectId}:${candidate.projectId ?? ''}`,
          candidate,
        ]),
      ).values(),
    ];
    const keys = new Set(
      candidates.map((c) => `${c.flagType}:${c.objectId}:${c.projectId ?? ''}`),
    );
    const existing = await this.prisma.dataQualityFlag.findMany({
      where: {
        isResolved: false,
        ...(projectId ? { projectId } : {}),
      },
    });
    for (const flag of existing) {
      const key = `${flag.flagType}:${flag.objectId}:${flag.projectId ?? ''}`;
      if (!keys.has(key)) {
        await this.prisma.dataQualityFlag.update({
          where: { id: flag.id },
          data: { isResolved: true, resolvedAt: new Date() },
        });
      }
    }
    for (const candidate of candidates) {
      const current = existing.find(
        (flag) =>
          flag.flagType === candidate.flagType &&
          flag.objectId === candidate.objectId &&
          flag.projectId === candidate.projectId,
      );
      const data = {
        ...candidate,
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      } satisfies Prisma.DataQualityFlagUncheckedUpdateInput;
      if (current) {
        await this.prisma.dataQualityFlag.update({
          where: { id: current.id },
          data,
        });
      } else {
        await this.prisma.dataQualityFlag.create({ data: candidate });
      }
    }
  }

  private isEnabled(flagType: DataQualityFlagType, rules: DataQualityRules) {
    if (rules.enabled?.[flagType] === false) return false;
    if (rules.excludeFlagTypes?.includes(flagType)) return false;
    return (
      !rules.includeFlagTypes?.length ||
      rules.includeFlagTypes.includes(flagType)
    );
  }

  private parseRules(value: Prisma.JsonValue): DataQualityRules {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return this.normalizeRules(value as DataQualityRules);
  }

  private normalizeRules(rules: DataQualityRules): DataQualityRules {
    const validTypes = new Set<DataQualityFlagType>(
      Object.values(DATA_QUALITY_FLAG_TYPE),
    );
    const includeFlagTypes = (rules.includeFlagTypes ?? []).filter((type) =>
      validTypes.has(type),
    );
    const excludeFlagTypes = (rules.excludeFlagTypes ?? []).filter((type) =>
      validTypes.has(type),
    );
    const enabled = Object.fromEntries(
      Object.entries(rules.enabled ?? {}).filter(
        ([type, value]) =>
          validTypes.has(type as DataQualityFlagType) &&
          typeof value === 'boolean',
      ),
    ) as DataQualityRules['enabled'];
    return {
      ...(includeFlagTypes.length ? { includeFlagTypes } : {}),
      ...(excludeFlagTypes.length ? { excludeFlagTypes } : {}),
      ...(Object.keys(enabled ?? {}).length ? { enabled } : {}),
    };
  }
}
