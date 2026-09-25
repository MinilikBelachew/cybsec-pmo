import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../../casl/casl-ability.interceptor';
import { CheckModulePermission } from '../../casl/decorators/check-module-permission.decorator';
import { CaslGuard } from '../../casl/casl.guard';
import { ModulePermissionGuard } from '../../casl/module-permission.guard';
import { ZohoConnectionService } from './zoho-connection.service';
import { PaymentDelayAlertService } from './payment-delay-alert.service';
import { DiscrepancyAlertService } from './discrepancy-alert.service';
import {
  ZohoOpportunityDto,
  ZohoOpportunitySyncResultDto,
  ZohoStatusDto,
  ZohoTestResultDto,
  ZohoBooksStatusDto,
  ZohoInvoiceSyncResultDto,
  ZohoInvoiceDto,
  LinkZohoInvoiceDto,
  LinkZohoInvoiceMilestoneDto,
  PaymentDelayAlertResultDto,
  DiscrepancyAlertResultDto,
  ZohoFailedSyncRecordListDto,
  RetryZohoSyncDto,
  RetryZohoSyncResultDto,
} from './dto/zoho.dto';

type RequestWithUser = {
  user?: { id: string };
};

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Integrations')
@Controller({
  path: 'integrations/zoho',
  version: '1',
})
export class ZohoController {
  constructor(
    private readonly zohoConnection: ZohoConnectionService,
    private readonly paymentDelayAlerts: PaymentDelayAlertService,
    private readonly discrepancyAlerts: DiscrepancyAlertService,
  ) {}

  @CheckModulePermission('integrations', 'view')
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoStatusDto })
  async status(): Promise<ZohoStatusDto> {
    return this.zohoConnection.getStatus();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoTestResultDto })
  async test(): Promise<ZohoTestResultDto> {
    return this.zohoConnection.testConnection();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('sync/opportunities')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoOpportunitySyncResultDto })
  async syncOpportunities(): Promise<ZohoOpportunitySyncResultDto> {
    return this.zohoConnection.syncOpportunities();
  }

  @CheckModulePermission('integrations', 'view')
  @Get('opportunities')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [ZohoOpportunityDto] })
  async listOpportunities(
    @Query('limit') limit?: string,
  ): Promise<ZohoOpportunityDto[]> {
    return this.zohoConnection.listOpportunities(
      limit ? Number(limit) : 50,
    );
  }

  @CheckModulePermission('integrations', 'view')
  @Get('failed-syncs')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'integration', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'dead_letter', 'resolved', 'all'],
  })
  @ApiOkResponse({ type: ZohoFailedSyncRecordListDto })
  async listFailedSyncs(
    @Query('integration') integration: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'pending' | 'dead_letter' | 'resolved' | 'all',
  ): Promise<ZohoFailedSyncRecordListDto> {
    return this.zohoConnection.listFailedSyncRecords({
      integration,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
    });
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RetryZohoSyncResultDto })
  async retrySync(
    @Body() body: RetryZohoSyncDto,
    @Request() request: RequestWithUser,
  ): Promise<RetryZohoSyncResultDto> {
    return this.zohoConnection.retryFailedSync(
      { failedSyncRecordId: body.failedSyncRecordId },
      request.user!.id,
    );
  }

  @CheckModulePermission('integrations', 'view')
  @Get('books/status')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoBooksStatusDto })
  async booksStatus(): Promise<ZohoBooksStatusDto> {
    return this.zohoConnection.getBooksStatus();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('books/test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoTestResultDto })
  async booksTest(): Promise<ZohoTestResultDto> {
    return this.zohoConnection.testBooksConnection();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('books/sync/invoices')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoInvoiceSyncResultDto })
  async syncInvoices(): Promise<ZohoInvoiceSyncResultDto> {
    return this.zohoConnection.syncInvoices();
  }

  @CheckModulePermission('integrations', 'view')
  @Get('books/invoices')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [ZohoInvoiceDto] })
  async listInvoices(
    @Query('limit') limit?: string,
  ): Promise<ZohoInvoiceDto[]> {
    return this.zohoConnection.listInvoices(limit ? Number(limit) : 50);
  }

  @CheckModulePermission('integrations', 'configure')
  @Patch('books/invoices/:id/link')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoInvoiceDto })
  async linkInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkZohoInvoiceDto,
  ): Promise<ZohoInvoiceDto> {
    return this.zohoConnection.linkInvoice(id, body.projectId ?? null);
  }

  @CheckModulePermission('integrations', 'configure')
  @Patch('books/invoices/:id/milestone')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ZohoInvoiceDto })
  async linkInvoiceMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkZohoInvoiceMilestoneDto,
  ): Promise<ZohoInvoiceDto> {
    return this.zohoConnection.linkInvoiceMilestone(
      id,
      body.milestoneId ?? null,
    );
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('books/alerts/payment-delay')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PaymentDelayAlertResultDto })
  async runPaymentDelayAlerts(): Promise<PaymentDelayAlertResultDto> {
    return this.paymentDelayAlerts.processPaymentDelayAlerts();
  }

  @CheckModulePermission('integrations', 'configure')
  @Post('books/alerts/discrepancy')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DiscrepancyAlertResultDto })
  async runDiscrepancyAlerts(): Promise<DiscrepancyAlertResultDto> {
    return this.discrepancyAlerts.processDiscrepancyAlerts();
  }
}
