import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { AlertEngineService } from '../alerts/alert-engine.service';
import { RoleEnum } from '../roles/roles.enum';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { RiskDto } from './dto/risk.dto';

const CLOSED_STATUSES = new Set(['Closed', 'Cancelled', 'Accepted']);
const ALLOWED_STATUSES = new Set([
  'Open',
  'Mitigating',
  'Accepted',
  'Closed',
  'Cancelled',
]);

/** Engineers only see risks they own and may update status only. */
const RISK_ASSIGNEE_ROLES = new Set<string>([RoleEnum.engineer]);

/** Roles that may create/edit/delete risks (matches risks:edit in RBAC seed). */
const RISK_MANAGER_ROLES = new Set<string>([
  RoleEnum.super_admin,
  RoleEnum.it_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
]);

/** Score at or above this value is treated as high and linked to dashboard alerts. */
export const RISK_HIGH_SCORE_THRESHOLD = 12;

function asDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return asDateOnly(value).toISOString().slice(0, 10);
}

function computeScore(impact: number, likelihood: number): number {
  return impact * likelihood;
}

function computeResidual(
  residualImpact?: number | null,
  residualLikelihood?: number | null,
): number | null {
  if (residualImpact == null || residualLikelihood == null) return null;
  return residualImpact * residualLikelihood;
}

type RiskRow = Prisma.RiskGetPayload<{
  include: {
    owner: { select: { id: true; displayName: true; email: true } };
    project: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notifications: NotificationsService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  private isAssigneeOnlyRole(roleCode?: string | null): boolean {
    return Boolean(roleCode && RISK_ASSIGNEE_ROLES.has(roleCode));
  }

  private isRiskManager(roleCode?: string | null): boolean {
    return Boolean(roleCode && RISK_MANAGER_ROLES.has(roleCode));
  }

  private ownerScope(caslUser: CaslUserContext): { ownerId: string } | object {
    return this.isAssigneeOnlyRole(caslUser.roleCode)
      ? { ownerId: caslUser.id }
      : {};
  }

  async listPortfolio(
    caslUser: CaslUserContext,
    filters?: { projectId?: string; status?: string; category?: string },
  ): Promise<RiskDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const rows = await this.prisma.risk.findMany({
      where: {
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.category ? { category: filters.category } : {}),
        ...this.ownerScope(caslUser),
        project: { AND: [scopeWhere] },
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<RiskDto[]> {
    await this.assertProjectAccess(projectId, caslUser);
    const rows = await this.prisma.risk.findMany({
      where: { projectId, ...this.ownerScope(caslUser) },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async getById(riskId: string, caslUser: CaslUserContext): Promise<RiskDto> {
    const row = await this.prisma.risk.findFirst({
      where: { id: riskId, ...this.ownerScope(caslUser) },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Risk not found');
    }
    await this.assertProjectAccess(row.projectId, caslUser);
    return this.toDto(row);
  }

  async createForProject(
    projectId: string,
    dto: CreateRiskDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<RiskDto> {
    await this.assertProjectAccess(projectId, caslUser);
    await this.assertOwnerExists(dto.ownerId);

    const status = dto.status?.trim() || 'Open';
    this.assertStatus(status);

    const score = computeScore(dto.impact, dto.likelihood);
    const residualRating = computeResidual(
      dto.residualImpact,
      dto.residualLikelihood,
    );

    const created = await this.prisma.risk.create({
      data: {
        projectId,
        title: dto.title.trim(),
        category: dto.category.trim(),
        impact: dto.impact,
        likelihood: dto.likelihood,
        score,
        ownerId: dto.ownerId,
        mitigationPlan: dto.mitigationPlan?.trim() || null,
        targetDate: dto.targetDate ? asDateOnly(dto.targetDate) : null,
        residualImpact: dto.residualImpact ?? null,
        residualLikelihood: dto.residualLikelihood ?? null,
        residualRating,
        status,
        closedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.RISK_ASSIGNED,
      recipientUserIds: [dto.ownerId],
      title: 'Risk assigned',
      body: `You own risk “${created.title}” (score ${created.score}).`,
      payload: {
        projectId,
        riskId: created.id,
        score: created.score,
      },
      sourceObjectType: 'Risk',
      sourceObjectId: created.id,
      actorId,
      includeActorAsRecipient: true,
    });

    if (score >= RISK_HIGH_SCORE_THRESHOLD) {
      await this.notifyThresholdBreached(created, actorId);
    }

    return this.toDto(created);
  }

  async updateForProject(
    projectId: string,
    riskId: string,
    dto: UpdateRiskDto,
    actorId: string,
    caslUser: CaslUserContext,
  ): Promise<RiskDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const existing = await this.prisma.risk.findFirst({
      where: { id: riskId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Risk not found');
    }

    const isAssigneeOnly = this.isAssigneeOnlyRole(caslUser.roleCode);
    const isOwner =
      existing.ownerId === caslUser.id || existing.ownerId === actorId;

    if (isAssigneeOnly) {
      if (!isOwner) {
        throw new ForbiddenException(
          'You can only update risks assigned to you',
        );
      }
      const forbiddenKeys = (
        [
          'title',
          'category',
          'impact',
          'likelihood',
          'ownerId',
          'mitigationPlan',
          'targetDate',
          'residualImpact',
          'residualLikelihood',
        ] as const
      ).filter((key) => dto[key] !== undefined);
      if (forbiddenKeys.length > 0) {
        throw new ForbiddenException(
          'You can only update the status of risks assigned to you',
        );
      }
      if (dto.status === undefined) {
        throw new BadRequestException('No allowed fields to update');
      }
    } else if (!this.isRiskManager(caslUser.roleCode)) {
      throw new ForbiddenException('You cannot update this risk');
    }

    if (dto.ownerId) {
      await this.assertOwnerExists(dto.ownerId);
    }
    if (dto.status) {
      this.assertStatus(dto.status.trim());
    }

    const nextImpact = dto.impact ?? existing.impact;
    const nextLikelihood = dto.likelihood ?? existing.likelihood;
    const score = computeScore(nextImpact, nextLikelihood);

    const nextResidualImpact =
      dto.residualImpact !== undefined
        ? dto.residualImpact
        : existing.residualImpact;
    const nextResidualLikelihood =
      dto.residualLikelihood !== undefined
        ? dto.residualLikelihood
        : existing.residualLikelihood;
    const residualRating = computeResidual(
      nextResidualImpact,
      nextResidualLikelihood,
    );

    const nextStatus = dto.status?.trim() ?? existing.status;
    const willClose = CLOSED_STATUSES.has(nextStatus);

    const updated = await this.prisma.risk.update({
      where: { id: riskId },
      data: {
        ...(!isAssigneeOnly && dto.title !== undefined
          ? { title: dto.title.trim() }
          : {}),
        ...(!isAssigneeOnly && dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(!isAssigneeOnly && dto.impact !== undefined
          ? { impact: dto.impact }
          : {}),
        ...(!isAssigneeOnly && dto.likelihood !== undefined
          ? { likelihood: dto.likelihood }
          : {}),
        score,
        ...(!isAssigneeOnly && dto.ownerId !== undefined
          ? { ownerId: dto.ownerId }
          : {}),
        ...(!isAssigneeOnly && dto.mitigationPlan !== undefined
          ? { mitigationPlan: dto.mitigationPlan?.trim() || null }
          : {}),
        ...(!isAssigneeOnly && dto.targetDate !== undefined
          ? {
              targetDate: dto.targetDate ? asDateOnly(dto.targetDate) : null,
            }
          : {}),
        ...(!isAssigneeOnly && dto.residualImpact !== undefined
          ? { residualImpact: dto.residualImpact }
          : {}),
        ...(!isAssigneeOnly && dto.residualLikelihood !== undefined
          ? { residualLikelihood: dto.residualLikelihood }
          : {}),
        residualRating,
        ...(dto.status !== undefined ? { status: nextStatus } : {}),
        closedAt: willClose ? existing.closedAt ?? new Date() : null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!isAssigneeOnly && dto.ownerId && dto.ownerId !== existing.ownerId) {
      await this.notifications.notify({
        eventType: NOTIFICATION_EVENT_TYPE.RISK_ASSIGNED,
        recipientUserIds: [dto.ownerId],
        title: 'Risk assigned',
        body: `You own risk “${updated.title}” (score ${updated.score}).`,
        payload: { projectId, riskId: updated.id, score: updated.score },
        sourceObjectType: 'Risk',
        sourceObjectId: updated.id,
        actorId,
        includeActorAsRecipient: true,
      });
    }

    if (
      score >= RISK_HIGH_SCORE_THRESHOLD &&
      existing.score < RISK_HIGH_SCORE_THRESHOLD
    ) {
      await this.notifyThresholdBreached(updated, actorId);
    }

    return this.toDto(updated);
  }

  async closeForProject(
    projectId: string,
    riskId: string,
    caslUser: CaslUserContext,
  ): Promise<RiskDto> {
    return this.updateForProject(
      projectId,
      riskId,
      { status: 'Closed' },
      caslUser.id,
      caslUser,
    );
  }

  async removeForProject(
    projectId: string,
    riskId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    if (this.isAssigneeOnlyRole(caslUser.roleCode)) {
      throw new ForbiddenException('You cannot delete risks');
    }
    await this.assertProjectAccess(projectId, caslUser);
    const existing = await this.prisma.risk.findFirst({
      where: { id: riskId, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Risk not found');
    }
    await this.prisma.risk.delete({ where: { id: riskId } });
  }

  private async notifyThresholdBreached(
    risk: { id: string; title: string; score: number; ownerId: string; projectId: string },
    actorId: string,
  ): Promise<void> {
    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.RISK_THRESHOLD_BREACHED,
      recipientUserIds: [risk.ownerId],
      title: 'High risk score',
      body: `Risk “${risk.title}” scored ${risk.score} (threshold ${RISK_HIGH_SCORE_THRESHOLD}).`,
      payload: {
        projectId: risk.projectId,
        riskId: risk.id,
        score: risk.score,
        threshold: RISK_HIGH_SCORE_THRESHOLD,
        link: '/dashboard/alerts',
      },
      sourceObjectType: 'Risk',
      sourceObjectId: risk.id,
      actorId,
      includeActorAsRecipient: true,
    });

    await this.alertEngine.fire({
      eventType: 'RISK_SCORE_BREACHED',
      objectType: 'Risk',
      objectId: risk.id,
      title: 'High risk score',
      body: `Risk “${risk.title}” scored ${risk.score} (threshold ${RISK_HIGH_SCORE_THRESHOLD}).`,
      payload: {
        projectId: risk.projectId,
        riskId: risk.id,
        score: risk.score,
        link: '/dashboard/alerts',
      },
      actorId,
      metricValue: risk.score,
    });
  }

  private async assertProjectAccess(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }
  }

  private async assertOwnerExists(ownerId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: ownerId, isActive: true },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('Owner user not found or inactive');
    }
  }

  private assertStatus(status: string): void {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new BadRequestException(
        'Status must be one of: Open, Mitigating, Accepted, Closed, Cancelled',
      );
    }
  }

  private toDto(row: RiskRow): RiskDto {
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.project?.name,
      title: row.title,
      category: row.category,
      impact: row.impact,
      likelihood: row.likelihood,
      score: row.score,
      ownerId: row.ownerId,
      owner: row.owner
        ? {
            id: row.owner.id,
            displayName: row.owner.displayName,
            email: row.owner.email,
          }
        : undefined,
      mitigationPlan: row.mitigationPlan,
      targetDate: toIsoDate(row.targetDate),
      residualImpact: row.residualImpact,
      residualLikelihood: row.residualLikelihood,
      residualRating: row.residualRating,
      status: row.status,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      isHigh: row.score >= RISK_HIGH_SCORE_THRESHOLD,
    };
  }
}
