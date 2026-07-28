import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KEKA_SYNC_STATUS } from '../../integrations/keka/keka.constants';
import { TIMESHEET_STATUS } from '../../timesheets/timesheets.constants';
import {
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

@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  scanAll() {
    return this.scan();
  }

  scanProject(projectId: string) {
    return this.scan(projectId);
  }

  listFlags(query: {
    resolved?: boolean | string;
    projectId?: string;
    flagType?: string;
  }) {
    const resolved =
      query.resolved === undefined
        ? undefined
        : query.resolved === true || query.resolved === 'true';
    return this.prisma.dataQualityFlag.findMany({
      where: {
        ...(resolved === undefined ? {} : { isResolved: resolved }),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.flagType ? { flagType: query.flagType } : {}),
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ isResolved: 'asc' }, { flaggedAt: 'desc' }],
    });
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

    const rules = await this.getRules();
    await this.persistCandidates(
      candidates.filter((candidate) =>
        this.isEnabled(candidate.flagType, rules),
      ),
      projectId,
    );
    return this.listFlags({
      resolved: false,
      ...(projectId ? { projectId } : {}),
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
