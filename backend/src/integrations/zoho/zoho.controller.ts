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
} from './dto/zoho.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard, ModulePermissionGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Integrations')
@Controller({
  path: 'integrations/zoho',
  version: '1',
})
export class ZohoController {
  constructor(private readonly zohoConnection: ZohoConnectionService) {}

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
}
