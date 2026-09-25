import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CheckModulePermission } from '../casl/decorators/check-module-permission.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { ModulePermissionGuard } from '../casl/module-permission.guard';
import { BudgetService } from './budget.service';
import {
  BudgetAdjustmentDto,
  BudgetLineItemDto,
  BudgetRevisionDto,
  PortfolioBudgetRowDto,
  ProjectBudgetDto,
  ResourceCostBreakdownDto,
  ProjectInvoiceDto,
} from './dto/budget.dto';
import {
  CreateBudgetAdjustmentDto,
  CreateBudgetBaselineDto,
  CreateBudgetLineItemDto,
  CreateBudgetRevisionDto,
  UpdateBudgetLineItemDto,
} from './dto/create-budget.dto';

@ApiTags('Budget')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@Controller({ version: '1' })
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('budget')
  @ApiOkResponse({ type: [PortfolioBudgetRowDto] })
  listPortfolio(
    @Request() request: RequestWithAbility,
  ): Promise<PortfolioBudgetRowDto[]> {
    return this.budgetService.listPortfolio(request.caslUser!);
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('budget/invoices')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'linkedOnly',
    required: false,
    description: 'When true (default), only invoices linked to accessible projects',
  })
  @ApiOkResponse({ type: [ProjectInvoiceDto] })
  listPortfolioInvoices(
    @Request() request: RequestWithAbility,
    @Query('limit') limit?: string,
    @Query('linkedOnly') linkedOnly?: string,
  ): Promise<ProjectInvoiceDto[]> {
    const linked =
      linkedOnly === undefined
        ? true
        : !['0', 'false', 'no'].includes(linkedOnly.trim().toLowerCase());
    return this.budgetService.listPortfolioInvoices(request.caslUser!, {
      limit: limit ? Number(limit) : 200,
      linkedOnly: linked,
    });
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('projects/:projectId/invoices')
  @ApiOkResponse({ type: [ProjectInvoiceDto] })
  listProjectInvoices(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectInvoiceDto[]> {
    return this.budgetService.listProjectInvoices(
      projectId,
      request.caslUser!,
    );
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('budget/export')
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  )
  @ApiOkResponse({ description: 'Budget tracker export file' })
  async exportPortfolio(
    @Request() request: RequestWithAbility,
    @Query('format') format: 'xlsx' | 'csv' = 'xlsx',
    @Res() res: Response,
  ): Promise<void> {
    const safeFormat = format === 'csv' ? 'csv' : 'xlsx';
    const exported = await this.budgetService.exportPortfolio(
      request.caslUser!,
      safeFormat,
    );
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.filename}"`,
    );
    res.send(exported.buffer);
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('projects/:projectId/budget')
  @ApiOkResponse({ type: ProjectBudgetDto })
  getForProject(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectBudgetDto> {
    return this.budgetService.getForProject(projectId, request.caslUser!);
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/baseline')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProjectBudgetDto })
  createBaseline(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetBaselineDto,
    @Request() request: RequestWithAbility,
  ): Promise<ProjectBudgetDto> {
    return this.budgetService.createBaseline(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/revisions')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: BudgetRevisionDto })
  proposeRevision(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetRevisionDto,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetRevisionDto> {
    return this.budgetService.proposeRevision(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/revisions/:revisionId/approve')
  @ApiOkResponse({ type: BudgetRevisionDto })
  approveRevision(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetRevisionDto> {
    return this.budgetService.approveRevision(
      projectId,
      revisionId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/revisions/:revisionId/reject')
  @ApiOkResponse({ type: BudgetRevisionDto })
  rejectRevision(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetRevisionDto> {
    return this.budgetService.rejectRevision(
      projectId,
      revisionId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/line-items')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: BudgetLineItemDto })
  createLineItem(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetLineItemDto,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetLineItemDto> {
    return this.budgetService.createLineItem(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Patch('projects/:projectId/budget/line-items/:lineItemId')
  @ApiOkResponse({ type: BudgetLineItemDto })
  updateLineItem(
    @Param('projectId') projectId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: UpdateBudgetLineItemDto,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetLineItemDto> {
    return this.budgetService.updateLineItem(
      projectId,
      lineItemId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Delete('projects/:projectId/budget/line-items/:lineItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteLineItem(
    @Param('projectId') projectId: string,
    @Param('lineItemId') lineItemId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.budgetService.deleteLineItem(
      projectId,
      lineItemId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/adjustments')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: BudgetAdjustmentDto })
  proposeAdjustment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetAdjustmentDto,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetAdjustmentDto> {
    return this.budgetService.proposeAdjustment(
      projectId,
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/adjustments/:adjustmentId/approve')
  @ApiOkResponse({ type: BudgetAdjustmentDto })
  approveAdjustment(
    @Param('projectId') projectId: string,
    @Param('adjustmentId') adjustmentId: string,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetAdjustmentDto> {
    return this.budgetService.approveAdjustment(
      projectId,
      adjustmentId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('update', 'Financial')
  @CheckModulePermission('financials', 'edit')
  @Post('projects/:projectId/budget/adjustments/:adjustmentId/reject')
  @ApiOkResponse({ type: BudgetAdjustmentDto })
  rejectAdjustment(
    @Param('projectId') projectId: string,
    @Param('adjustmentId') adjustmentId: string,
    @Request() request: RequestWithAbility,
  ): Promise<BudgetAdjustmentDto> {
    return this.budgetService.rejectAdjustment(
      projectId,
      adjustmentId,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('read', 'Financial')
  @CheckModulePermission('financials', 'view')
  @Get('projects/:projectId/budget/resource-costs')
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['employee', 'month', 'detail'],
  })
  @ApiOkResponse({ type: ResourceCostBreakdownDto })
  listResourceCosts(
    @Param('projectId') projectId: string,
    @Query('groupBy') groupBy: 'employee' | 'month' | 'detail' = 'detail',
    @Request() request: RequestWithAbility,
  ): Promise<ResourceCostBreakdownDto> {
    const safeGroupBy =
      groupBy === 'employee' || groupBy === 'month' ? groupBy : 'detail';
    return this.budgetService.listResourceCosts(
      projectId,
      request.caslUser!,
      safeGroupBy,
    );
  }
}
