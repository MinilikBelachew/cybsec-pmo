import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { PermissionsCacheService } from '../casl/permissions-cache.service';
import { CaslUserContext } from '../casl/casl.types';
import { hasModulePermission } from '../casl/module-permission.util';
import { AuditLogsService } from '../audit/audit-logs.service';
import { TimesheetPayrollService } from '../timesheets/timesheet-payroll.service';
import {
  BUDGET_ADJUSTMENT_STATUS,
  BUDGET_ADJUSTMENT_TARGET,
  BUDGET_ADJUSTMENT_TARGETS,
  BUDGET_LINE_CATEGORIES,
  BUDGET_LINE_CATEGORY,
  BUDGET_REVISION_STATUS,
  DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT,
} from './budget.constants';
import {
  computeBudgetAmounts,
  decimalToNumber,
  sumDecimals,
} from './budget-calc.util';
import { BudgetOverrunService } from './budget-overrun.service';
import {
  BudgetAdjustmentDto,
  BudgetApproverDto,
  BudgetLineItemDto,
  BudgetRevisionDto,
  PortfolioBudgetRowDto,
  ProjectBudgetDto,
  ResourceCostBreakdownDto,
  ResourceCostRowDto,
} from './dto/budget.dto';
import {
  CreateBudgetAdjustmentDto,
  CreateBudgetBaselineDto,
  CreateBudgetLineItemDto,
  CreateBudgetRevisionDto,
  UpdateBudgetLineItemDto,
} from './dto/create-budget.dto';

type BudgetRow = Prisma.ProjectBudgetGetPayload<{
  include: {
    approver: { select: { id: true; displayName: true; email: true } };
    revisions: {
      include: {
        approver: { select: { id: true; displayName: true; email: true } };
      };
      orderBy: { createdAt: 'desc' };
    };
    lineItems: { orderBy: { createdAt: 'asc' } };
    adjustments: {
      include: {
        requester: { select: { id: true; displayName: true; email: true } };
        approver: { select: { id: true; displayName: true; email: true } };
      };
      orderBy: { createdAt: 'desc' };
    };
    project: { select: { id: true; value: true; currency: true } };
  };
}>;

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly auditLogs: AuditLogsService,
    private readonly overrun: BudgetOverrunService,
    private readonly timesheetPayroll: TimesheetPayrollService,
  ) {}

  async getForProject(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectBudgetDto> {
    const project = await this.assertProjectAccess(projectId, caslUser);
    await this.timesheetPayroll.ensureProjectResourceCosts(projectId);
    const budget = await this.loadBudget(projectId);
    return this.toDto(projectId, project, budget);
  }

  async listResourceCosts(
    projectId: string,
    caslUser: CaslUserContext,
    groupBy: 'employee' | 'month' | 'detail' = 'detail',
  ): Promise<ResourceCostBreakdownDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const includeRates = hasModulePermission(
      this.permissionsCache.getByRoleId(caslUser.roleId),
      'financials',
      'view_rates',
    );

    // Materialize costs from Approved timesheets + Keka EmployeeSalary rates.
    await this.timesheetPayroll.ensureProjectResourceCosts(projectId);

    const costs = await this.prisma.employeeCost.findMany({
      where: { projectId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            displayName: true,
            designation: true,
            employeeNumber: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { employeeId: 'asc' },
      ],
    });

    const employeeIds = [...new Set(costs.map((c) => c.employeeId))];
    const salaryFlags = employeeIds.length
      ? await this.prisma.employeeSalary.findMany({
          where: { employeeId: { in: employeeIds }, isCurrent: true },
          select: { employeeId: true, ratePerHour: true },
        })
      : [];
    const hasSalaryRate = new Set(
      salaryFlags
        .filter((s) => Number(s.ratePerHour ?? 0) > 0)
        .map((s) => s.employeeId),
    );

    const mapRow = (
      partial: Omit<ResourceCostRowDto, 'ratePerHour' | 'hasSalaryRate'> & {
        ratePerHour?: number | null;
        hasSalaryRate?: boolean;
      },
    ): ResourceCostRowDto => ({
      ...partial,
      employeeNumber: partial.employeeNumber ?? null,
      departmentName: partial.departmentName ?? null,
      hasSalaryRate: partial.hasSalaryRate ?? false,
      ratePerHour: includeRates ? (partial.ratePerHour ?? null) : null,
    });

    const employeeMeta = (row: (typeof costs)[number]) => ({
      employeeId: row.employeeId,
      employeeName:
        row.employee.displayName?.trim() ||
        row.employee.name ||
        row.employeeId,
      employeeNumber: row.employee.employeeNumber ?? null,
      designation: row.employee.designation ?? null,
      departmentName: row.employee.department?.name ?? null,
      hasSalaryRate: hasSalaryRate.has(row.employeeId),
    });

    if (groupBy === 'employee') {
      const byEmployee = new Map<
        string,
        {
          employeeId: string;
          employeeName: string;
          employeeNumber: string | null;
          designation: string | null;
          departmentName: string | null;
          hasSalaryRate: boolean;
          regularHours: number;
          overtimeHours: number;
          totalCost: number;
          rateSum: number;
          rateCount: number;
        }
      >();
      for (const row of costs) {
        const key = row.employeeId;
        const existing = byEmployee.get(key);
        const regular = decimalToNumber(row.regularHours) ?? 0;
        const overtime = decimalToNumber(row.overtimeHours) ?? 0;
        const total = decimalToNumber(row.totalCost) ?? 0;
        const rate = decimalToNumber(row.ratePerHour) ?? 0;
        const meta = employeeMeta(row);
        if (!existing) {
          byEmployee.set(key, {
            ...meta,
            regularHours: regular,
            overtimeHours: overtime,
            totalCost: total,
            rateSum: rate,
            rateCount: rate > 0 ? 1 : 0,
          });
        } else {
          existing.regularHours += regular;
          existing.overtimeHours += overtime;
          existing.totalCost += total;
          if (rate > 0) {
            existing.rateSum += rate;
            existing.rateCount += 1;
          }
        }
      }
      const rows = [...byEmployee.values()].map((r) =>
        mapRow({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          employeeNumber: r.employeeNumber,
          designation: r.designation,
          departmentName: r.departmentName,
          hasSalaryRate: r.hasSalaryRate,
          periodYear: null,
          periodMonth: null,
          regularHours: Number(r.regularHours.toFixed(2)),
          overtimeHours: Number(r.overtimeHours.toFixed(2)),
          totalCost: Number(r.totalCost.toFixed(2)),
          ratePerHour:
            r.rateCount > 0
              ? Number((r.rateSum / r.rateCount).toFixed(4))
              : null,
        }),
      );
      return { groupBy, includeRates, rows };
    }

    if (groupBy === 'month') {
      const byMonth = new Map<
        string,
        {
          periodYear: number;
          periodMonth: number;
          regularHours: number;
          overtimeHours: number;
          totalCost: number;
        }
      >();
      for (const row of costs) {
        const key = `${row.periodYear}-${row.periodMonth}`;
        const existing = byMonth.get(key);
        const regular = decimalToNumber(row.regularHours) ?? 0;
        const overtime = decimalToNumber(row.overtimeHours) ?? 0;
        const total = decimalToNumber(row.totalCost) ?? 0;
        if (!existing) {
          byMonth.set(key, {
            periodYear: row.periodYear,
            periodMonth: row.periodMonth,
            regularHours: regular,
            overtimeHours: overtime,
            totalCost: total,
          });
        } else {
          existing.regularHours += regular;
          existing.overtimeHours += overtime;
          existing.totalCost += total;
        }
      }
      const rows = [...byMonth.values()].map((r) =>
        mapRow({
          employeeId: null,
          employeeName: null,
          employeeNumber: null,
          designation: null,
          departmentName: null,
          hasSalaryRate: false,
          periodYear: r.periodYear,
          periodMonth: r.periodMonth,
          regularHours: Number(r.regularHours.toFixed(2)),
          overtimeHours: Number(r.overtimeHours.toFixed(2)),
          totalCost: Number(r.totalCost.toFixed(2)),
          ratePerHour: null,
        }),
      );
      return { groupBy, includeRates, rows };
    }

    const rows = costs.map((row) => {
      const meta = employeeMeta(row);
      return mapRow({
        ...meta,
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
        regularHours: decimalToNumber(row.regularHours) ?? 0,
        overtimeHours: decimalToNumber(row.overtimeHours) ?? 0,
        totalCost: decimalToNumber(row.totalCost) ?? 0,
        ratePerHour: decimalToNumber(row.ratePerHour),
      });
    });

    return { groupBy: 'detail', includeRates, rows };
  }

  async listPortfolio(
    caslUser: CaslUserContext,
  ): Promise<PortfolioBudgetRowDto[]> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const projects = await this.prisma.project.findMany({
      where: scopeWhere,
      select: {
        id: true,
        name: true,
        value: true,
        currency: true,
        projectBudget: {
          include: {
            revisions: {
              where: { status: BUDGET_REVISION_STATUS.APPROVED },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            lineItems: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const projectIds = projects.map((p) => p.id);
    type CostGroup = { projectId: string; _sum: { totalCost: Prisma.Decimal | null } };
    type InvoiceGroup = {
      projectId: string | null;
      _sum: { amount: Prisma.Decimal | null };
    };

    const [employeeGroups, invoiceGroups] = await Promise.all([
      projectIds.length
        ? this.prisma.employeeCost.groupBy({
            by: ['projectId'],
            where: { projectId: { in: projectIds } },
            _sum: { totalCost: true },
          })
        : Promise.resolve([] as CostGroup[]),
      projectIds.length
        ? this.prisma.invoice.groupBy({
            by: ['projectId'],
            where: { projectId: { in: projectIds } },
            _sum: { amount: true },
          })
        : Promise.resolve([] as InvoiceGroup[]),
    ]);

    const empMap = new Map<string, number>(
      employeeGroups.map((g) => [
        g.projectId,
        decimalToNumber(g._sum.totalCost) ?? 0,
      ]),
    );
    const invMap = new Map<string, number>(
      invoiceGroups
        .filter((g): g is InvoiceGroup & { projectId: string } => g.projectId != null)
        .map((g) => [
          g.projectId,
          decimalToNumber(g._sum.amount) ?? 0,
        ]),
    );

    return projects.map((project) => {
      const budget = project.projectBudget;
      const lineItems = budget?.lineItems ?? [];
      const summary = computeBudgetAmounts({
        baselineAmount: decimalToNumber(budget?.baselineAmount),
        approvedRevisionAmount: decimalToNumber(
          budget?.revisions[0]?.revisedAmount,
        ),
        plannedLineTotal: sumDecimals(lineItems.map((l) => l.planned)),
        employeeCostTotal: empMap.get(project.id) ?? 0,
        lineItemActualTotal: sumDecimals(lineItems.map((l) => l.actual)),
        otherActualTotal: sumDecimals(
          lineItems
            .filter((l) => l.category !== BUDGET_LINE_CATEGORY.RESOURCE)
            .map((l) => l.actual),
        ),
        projectValue: decimalToNumber(project.value),
        invoiceTotal: invMap.get(project.id) ?? 0,
      });
      const adherencePct =
        summary.expectedCost > 0
          ? Math.round(
              (summary.actualCost / summary.expectedCost) * 10000,
            ) / 100
          : null;

      return {
        projectId: project.id,
        projectName: project.name,
        currency: budget?.currency ?? project.currency ?? 'USD',
        budgetId: budget?.id ?? null,
        baselineAmount: summary.baselineAmount,
        currentBudgetAmount: summary.currentBudgetAmount,
        expectedCost: summary.expectedCost,
        actualCost: summary.actualCost,
        variance: summary.variance,
        variancePct: summary.variancePct,
        revenue: summary.revenue,
        margin: summary.margin,
        marginPct: summary.marginPct,
        adherencePct,
        overrun:
          adherencePct != null &&
          adherencePct >= DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT,
      };
    });
  }

  async exportPortfolio(
    caslUser: CaslUserContext,
    format: 'xlsx' | 'csv',
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const rows = await this.listPortfolio(caslUser);
    const date = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const header = [
        'Project',
        'Currency',
        'Baseline',
        'Current',
        'Expected',
        'Actual',
        'Variance',
        'Variance %',
        'Revenue',
        'Margin',
        'Margin %',
        'Adherence %',
        'Overrun',
      ];
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [
            csvEscape(r.projectName),
            r.currency,
            r.baselineAmount ?? '',
            r.currentBudgetAmount ?? '',
            r.expectedCost,
            r.actualCost,
            r.variance,
            r.variancePct ?? '',
            r.revenue,
            r.margin,
            r.marginPct ?? '',
            r.adherencePct ?? '',
            r.overrun ? 'Yes' : 'No',
          ].join(','),
        ),
      ];
      return {
        buffer: Buffer.from(lines.join('\n'), 'utf8'),
        filename: `budget_tracker_${date}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cybsec PMO';
    const sheet = workbook.addWorksheet('Budget Tracker');
    sheet.columns = [
      { header: 'Project', key: 'projectName', width: 32 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Baseline', key: 'baselineAmount', width: 14 },
      { header: 'Current', key: 'currentBudgetAmount', width: 14 },
      { header: 'Expected', key: 'expectedCost', width: 14 },
      { header: 'Actual', key: 'actualCost', width: 14 },
      { header: 'Variance', key: 'variance', width: 14 },
      { header: 'Variance %', key: 'variancePct', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 14 },
      { header: 'Margin', key: 'margin', width: 14 },
      { header: 'Margin %', key: 'marginPct', width: 12 },
      { header: 'Adherence %', key: 'adherencePct', width: 12 },
      { header: 'Overrun', key: 'overrun', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({
        ...r,
        overrun: r.overrun ? 'Yes' : 'No',
      });
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `budget_tracker_${date}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async createBaseline(
    projectId: string,
    dto: CreateBudgetBaselineDto,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<ProjectBudgetDto> {
    const project = await this.assertProjectAccess(projectId, caslUser);

    const existing = await this.prisma.projectBudget.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Project already has an approved budget baseline. Propose a revision instead.',
      );
    }

    const currency = (dto.currency ?? project.currency ?? 'USD').trim();
    if (!currency) {
      throw new BadRequestException('Currency is required');
    }

    const created = await this.prisma.projectBudget.create({
      data: {
        projectId,
        baselineAmount: new Prisma.Decimal(dto.amount),
        currency,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_BASELINE_APPROVED',
      objectType: 'ProjectBudget',
      objectId: created.id,
      newValue: {
        projectId,
        baselineAmount: dto.amount,
        currency,
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
    const budget = await this.loadBudget(projectId);
    return this.toDto(projectId, project, budget);
  }

  async proposeRevision(
    projectId: string,
    dto: CreateBudgetRevisionDto,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetRevisionDto> {
    const project = await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);

    const pending = await this.prisma.budgetRevision.findFirst({
      where: {
        budgetId: budget.id,
        status: BUDGET_REVISION_STATUS.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'A pending revision already exists. Approve or reject it first.',
      );
    }

    const revision = await this.prisma.budgetRevision.create({
      data: {
        budgetId: budget.id,
        revisedAmount: new Prisma.Decimal(dto.revisedAmount),
        reason: dto.reason.trim(),
        status: BUDGET_REVISION_STATUS.PENDING,
      },
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_REVISION_PROPOSED',
      objectType: 'BudgetRevision',
      objectId: revision.id,
      newValue: {
        projectId: project.id,
        budgetId: budget.id,
        revisedAmount: dto.revisedAmount,
        reason: dto.reason.trim(),
      },
      user: { connect: { id: userId } },
    });

    return this.toRevisionDto(revision);
  }

  async approveRevision(
    projectId: string,
    revisionId: string,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetRevisionDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const revision = await this.requirePendingRevision(budget.id, revisionId);

    const updated = await this.prisma.budgetRevision.update({
      where: { id: revision.id },
      data: {
        status: BUDGET_REVISION_STATUS.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_REVISION_APPROVED',
      objectType: 'BudgetRevision',
      objectId: updated.id,
      oldValue: {
        status: revision.status,
        revisedAmount: Number(revision.revisedAmount),
      },
      newValue: {
        projectId,
        status: BUDGET_REVISION_STATUS.APPROVED,
        revisedAmount: Number(updated.revisedAmount),
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
    return this.toRevisionDto(updated);
  }

  async rejectRevision(
    projectId: string,
    revisionId: string,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetRevisionDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const revision = await this.requirePendingRevision(budget.id, revisionId);

    const updated = await this.prisma.budgetRevision.update({
      where: { id: revision.id },
      data: {
        status: BUDGET_REVISION_STATUS.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_REVISION_REJECTED',
      objectType: 'BudgetRevision',
      objectId: updated.id,
      oldValue: {
        status: revision.status,
        revisedAmount: Number(revision.revisedAmount),
      },
      newValue: {
        projectId,
        status: BUDGET_REVISION_STATUS.REJECTED,
        revisedAmount: Number(updated.revisedAmount),
      },
      user: { connect: { id: userId } },
    });

    return this.toRevisionDto(updated);
  }

  async createLineItem(
    projectId: string,
    dto: CreateBudgetLineItemDto,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetLineItemDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    this.assertCategory(dto.category);

    const row = await this.prisma.budgetLineItem.create({
      data: {
        budgetId: budget.id,
        category: dto.category.trim(),
        itemName: dto.itemName.trim(),
        planned: new Prisma.Decimal(dto.planned),
        actual: new Prisma.Decimal(dto.actual ?? 0),
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_LINE_CREATED',
      objectType: 'BudgetLineItem',
      objectId: row.id,
      newValue: {
        projectId,
        category: row.category,
        itemName: row.itemName,
        planned: Number(row.planned),
        actual: Number(row.actual),
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
    return this.toLineItemDto(row);
  }

  async updateLineItem(
    projectId: string,
    lineItemId: string,
    dto: UpdateBudgetLineItemDto,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetLineItemDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const existing = await this.prisma.budgetLineItem.findFirst({
      where: { id: lineItemId, budgetId: budget.id },
    });
    if (!existing) {
      throw new NotFoundException('Budget line item not found');
    }
    if (dto.category != null) {
      this.assertCategory(dto.category);
    }

    const updated = await this.prisma.budgetLineItem.update({
      where: { id: existing.id },
      data: {
        ...(dto.category != null ? { category: dto.category.trim() } : {}),
        ...(dto.itemName != null ? { itemName: dto.itemName.trim() } : {}),
        ...(dto.planned != null
          ? { planned: new Prisma.Decimal(dto.planned) }
          : {}),
        ...(dto.actual != null
          ? { actual: new Prisma.Decimal(dto.actual) }
          : {}),
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_LINE_UPDATED',
      objectType: 'BudgetLineItem',
      objectId: updated.id,
      oldValue: {
        category: existing.category,
        itemName: existing.itemName,
        planned: Number(existing.planned),
        actual: Number(existing.actual),
      },
      newValue: {
        projectId,
        category: updated.category,
        itemName: updated.itemName,
        planned: Number(updated.planned),
        actual: Number(updated.actual),
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
    return this.toLineItemDto(updated);
  }

  async deleteLineItem(
    projectId: string,
    lineItemId: string,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const existing = await this.prisma.budgetLineItem.findFirst({
      where: { id: lineItemId, budgetId: budget.id },
    });
    if (!existing) {
      throw new NotFoundException('Budget line item not found');
    }

    await this.prisma.budgetLineItem.delete({ where: { id: existing.id } });

    await this.auditLogs.create({
      action: 'BUDGET_LINE_DELETED',
      objectType: 'BudgetLineItem',
      objectId: existing.id,
      oldValue: {
        projectId,
        category: existing.category,
        itemName: existing.itemName,
        planned: Number(existing.planned),
        actual: Number(existing.actual),
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
  }

  async proposeAdjustment(
    projectId: string,
    dto: CreateBudgetAdjustmentDto,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetAdjustmentDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);

    if (
      !(BUDGET_ADJUSTMENT_TARGETS as readonly string[]).includes(dto.targetField)
    ) {
      throw new BadRequestException(
        `targetField must be one of: ${BUDGET_ADJUSTMENT_TARGETS.join(', ')}`,
      );
    }

    let oldAmount = 0;
    let lineItemId: string | null = null;

    if (
      dto.targetField === BUDGET_ADJUSTMENT_TARGET.LINE_ACTUAL ||
      dto.targetField === BUDGET_ADJUSTMENT_TARGET.LINE_PLANNED
    ) {
      if (!dto.lineItemId) {
        throw new BadRequestException('lineItemId is required for line adjustments');
      }
      const line = await this.prisma.budgetLineItem.findFirst({
        where: { id: dto.lineItemId, budgetId: budget.id },
      });
      if (!line) {
        throw new NotFoundException('Budget line item not found');
      }
      lineItemId = line.id;
      oldAmount =
        dto.targetField === BUDGET_ADJUSTMENT_TARGET.LINE_ACTUAL
          ? Number(line.actual)
          : Number(line.planned);
    } else {
      const full = await this.prisma.projectBudget.findUniqueOrThrow({
        where: { id: budget.id },
        select: { baselineAmount: true },
      });
      oldAmount = Number(full.baselineAmount);
    }

    const pending = await this.prisma.budgetAdjustment.findFirst({
      where: {
        budgetId: budget.id,
        status: BUDGET_ADJUSTMENT_STATUS.PENDING,
        targetField: dto.targetField,
        ...(lineItemId ? { lineItemId } : { lineItemId: null }),
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'A pending adjustment already exists for this target. Approve or reject it first.',
      );
    }

    const row = await this.prisma.budgetAdjustment.create({
      data: {
        budgetId: budget.id,
        lineItemId,
        targetField: dto.targetField,
        oldAmount: new Prisma.Decimal(oldAmount),
        newAmount: new Prisma.Decimal(dto.newAmount),
        reason: dto.reason.trim(),
        status: BUDGET_ADJUSTMENT_STATUS.PENDING,
        requestedBy: userId,
      },
      include: {
        requester: { select: { id: true, displayName: true, email: true } },
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_ADJUSTMENT_PROPOSED',
      objectType: 'BudgetAdjustment',
      objectId: row.id,
      newValue: {
        projectId,
        targetField: dto.targetField,
        lineItemId,
        oldAmount,
        newAmount: dto.newAmount,
        reason: dto.reason.trim(),
      },
      user: { connect: { id: userId } },
    });

    return this.toAdjustmentDto(row);
  }

  async approveAdjustment(
    projectId: string,
    adjustmentId: string,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetAdjustmentDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const adjustment = await this.requirePendingAdjustment(
      budget.id,
      adjustmentId,
    );

    await this.prisma.$transaction(async (tx) => {
      if (
        adjustment.targetField === BUDGET_ADJUSTMENT_TARGET.LINE_ACTUAL &&
        adjustment.lineItemId
      ) {
        await tx.budgetLineItem.update({
          where: { id: adjustment.lineItemId },
          data: { actual: adjustment.newAmount },
        });
      } else if (
        adjustment.targetField === BUDGET_ADJUSTMENT_TARGET.LINE_PLANNED &&
        adjustment.lineItemId
      ) {
        await tx.budgetLineItem.update({
          where: { id: adjustment.lineItemId },
          data: { planned: adjustment.newAmount },
        });
      } else if (adjustment.targetField === BUDGET_ADJUSTMENT_TARGET.BASELINE) {
        await tx.projectBudget.update({
          where: { id: budget.id },
          data: { baselineAmount: adjustment.newAmount },
        });
      }

      await tx.budgetAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: BUDGET_ADJUSTMENT_STATUS.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    });

    const updated = await this.prisma.budgetAdjustment.findUniqueOrThrow({
      where: { id: adjustment.id },
      include: {
        requester: { select: { id: true, displayName: true, email: true } },
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_ADJUSTMENT_APPROVED',
      objectType: 'BudgetAdjustment',
      objectId: updated.id,
      oldValue: {
        status: adjustment.status,
        oldAmount: Number(adjustment.oldAmount),
        newAmount: Number(adjustment.newAmount),
      },
      newValue: {
        projectId,
        status: BUDGET_ADJUSTMENT_STATUS.APPROVED,
        targetField: updated.targetField,
        appliedAmount: Number(updated.newAmount),
      },
      user: { connect: { id: userId } },
    });

    await this.overrun.evaluateProject(projectId, userId);
    return this.toAdjustmentDto(updated);
  }

  async rejectAdjustment(
    projectId: string,
    adjustmentId: string,
    userId: string,
    caslUser: CaslUserContext,
  ): Promise<BudgetAdjustmentDto> {
    await this.assertProjectAccess(projectId, caslUser);
    const budget = await this.requireBudget(projectId);
    const adjustment = await this.requirePendingAdjustment(
      budget.id,
      adjustmentId,
    );

    const updated = await this.prisma.budgetAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: BUDGET_ADJUSTMENT_STATUS.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, displayName: true, email: true } },
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.auditLogs.create({
      action: 'BUDGET_ADJUSTMENT_REJECTED',
      objectType: 'BudgetAdjustment',
      objectId: updated.id,
      oldValue: { status: adjustment.status },
      newValue: {
        projectId,
        status: BUDGET_ADJUSTMENT_STATUS.REJECTED,
      },
      user: { connect: { id: userId } },
    });

    return this.toAdjustmentDto(updated);
  }

  private async loadBudget(projectId: string): Promise<BudgetRow | null> {
    return this.prisma.projectBudget.findUnique({
      where: { projectId },
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
        revisions: {
          include: {
            approver: { select: { id: true, displayName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        lineItems: { orderBy: { createdAt: 'asc' } },
        adjustments: {
          include: {
            requester: { select: { id: true, displayName: true, email: true } },
            approver: { select: { id: true, displayName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        project: { select: { id: true, value: true, currency: true } },
      },
    });
  }

  private async requireBudget(projectId: string) {
    const budget = await this.prisma.projectBudget.findUnique({
      where: { projectId },
      select: { id: true, currency: true },
    });
    if (!budget) {
      throw new NotFoundException(
        'No approved budget baseline exists for this project',
      );
    }
    return budget;
  }

  private async requirePendingRevision(budgetId: string, revisionId: string) {
    const revision = await this.prisma.budgetRevision.findFirst({
      where: { id: revisionId, budgetId },
    });
    if (!revision) {
      throw new NotFoundException('Budget revision not found');
    }
    if (revision.status !== BUDGET_REVISION_STATUS.PENDING) {
      throw new BadRequestException(
        `Revision is already ${revision.status.toLowerCase()}`,
      );
    }
    return revision;
  }

  private async requirePendingAdjustment(
    budgetId: string,
    adjustmentId: string,
  ) {
    const adjustment = await this.prisma.budgetAdjustment.findFirst({
      where: { id: adjustmentId, budgetId },
    });
    if (!adjustment) {
      throw new NotFoundException('Budget adjustment not found');
    }
    if (adjustment.status !== BUDGET_ADJUSTMENT_STATUS.PENDING) {
      throw new BadRequestException(
        `Adjustment is already ${adjustment.status.toLowerCase()}`,
      );
    }
    return adjustment;
  }

  private async assertProjectAccess(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<{ id: string; value: Prisma.Decimal | null; currency: string }> {
    const scopeWhere = this.recordScopeWhere.projectWhere(caslUser, 'read');
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scopeWhere] },
      select: { id: true, value: true, currency: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found or not accessible');
    }
    return project;
  }

  private assertCategory(category: string): void {
    if (
      !(BUDGET_LINE_CATEGORIES as readonly string[]).includes(category.trim())
    ) {
      throw new BadRequestException(
        `Category must be one of: ${BUDGET_LINE_CATEGORIES.join(', ')}`,
      );
    }
  }

  private async toDto(
    projectId: string,
    project: { id: string; value: Prisma.Decimal | null; currency: string },
    budget: BudgetRow | null,
  ): Promise<ProjectBudgetDto> {
    const [employeeAgg, invoiceAgg] = await Promise.all([
      this.prisma.employeeCost.aggregate({
        where: { projectId },
        _sum: { totalCost: true },
      }),
      this.prisma.invoice.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
    ]);

    const lineItems = budget?.lineItems ?? [];
    const plannedLineTotal = sumDecimals(lineItems.map((l) => l.planned));
    const lineItemActualTotal = sumDecimals(lineItems.map((l) => l.actual));
    const otherActualTotal = sumDecimals(
      lineItems
        .filter((l) => l.category !== BUDGET_LINE_CATEGORY.RESOURCE)
        .map((l) => l.actual),
    );

    const approvedRevision = budget?.revisions.find(
      (r) => r.status === BUDGET_REVISION_STATUS.APPROVED,
    );

    const summary = computeBudgetAmounts({
      baselineAmount: decimalToNumber(budget?.baselineAmount),
      approvedRevisionAmount: decimalToNumber(approvedRevision?.revisedAmount),
      plannedLineTotal,
      employeeCostTotal: decimalToNumber(employeeAgg._sum.totalCost) ?? 0,
      lineItemActualTotal,
      otherActualTotal,
      projectValue: decimalToNumber(project.value),
      invoiceTotal: decimalToNumber(invoiceAgg._sum.amount) ?? 0,
    });

    const adherencePct =
      summary.expectedCost > 0
        ? Math.round(
            (summary.actualCost / summary.expectedCost) * 10000,
          ) / 100
        : null;

    return {
      projectId,
      currency: budget?.currency ?? project.currency ?? 'USD',
      budgetId: budget?.id ?? null,
      baselineAmount: decimalToNumber(budget?.baselineAmount),
      approvedBy: budget?.approvedBy ?? null,
      approver: this.toApproverDto(budget?.approver),
      approvedAt: budget?.approvedAt?.toISOString() ?? null,
      createdAt: budget?.createdAt?.toISOString() ?? null,
      summary,
      revisions: (budget?.revisions ?? []).map((r) => this.toRevisionDto(r)),
      lineItems: lineItems.map((l) => this.toLineItemDto(l)),
      adjustments: (budget?.adjustments ?? []).map((a) =>
        this.toAdjustmentDto(a),
      ),
      projectValue: decimalToNumber(project.value),
      adherencePct,
    };
  }

  private toRevisionDto(
    row: Prisma.BudgetRevisionGetPayload<{
      include: {
        approver: { select: { id: true; displayName: true; email: true } };
      };
    }>,
  ): BudgetRevisionDto {
    return {
      id: row.id,
      budgetId: row.budgetId,
      revisedAmount: Number(row.revisedAmount),
      reason: row.reason,
      status: row.status,
      approvedBy: row.approvedBy ?? null,
      approver: this.toApproverDto(row.approver),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toLineItemDto(
    row: Prisma.BudgetLineItemGetPayload<object>,
  ): BudgetLineItemDto {
    return {
      id: row.id,
      budgetId: row.budgetId,
      category: row.category,
      itemName: row.itemName,
      planned: Number(row.planned),
      actual: Number(row.actual),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toAdjustmentDto(
    row: Prisma.BudgetAdjustmentGetPayload<{
      include: {
        requester: { select: { id: true; displayName: true; email: true } };
        approver: { select: { id: true; displayName: true; email: true } };
      };
    }>,
  ): BudgetAdjustmentDto {
    return {
      id: row.id,
      budgetId: row.budgetId,
      lineItemId: row.lineItemId,
      targetField: row.targetField,
      oldAmount: Number(row.oldAmount),
      newAmount: Number(row.newAmount),
      reason: row.reason,
      status: row.status,
      requestedBy: row.requestedBy,
      requester: this.toApproverDto(row.requester),
      approvedBy: row.approvedBy ?? null,
      approver: this.toApproverDto(row.approver),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toApproverDto(
    user:
      | { id: string; displayName: string; email: string }
      | null
      | undefined,
  ): BudgetApproverDto | null {
    if (!user) return null;
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
    };
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
