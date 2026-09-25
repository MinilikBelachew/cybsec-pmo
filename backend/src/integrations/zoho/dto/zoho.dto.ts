import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class ZohoProvisionErrorDto {
  @ApiProperty()
  entityId: string;

  @ApiProperty()
  errorMsg: string;

  @ApiProperty()
  lastAttempted: string;

  @ApiProperty()
  retryCount: number;
}

export class ZohoStatusDto {
  @ApiProperty()
  configured: boolean;

  @ApiProperty()
  dc: string;

  @ApiPropertyOptional({ nullable: true })
  accountsBaseUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  apiBaseUrl: string | null;

  @ApiProperty()
  opportunityCount: number;

  @ApiPropertyOptional({ nullable: true })
  lastSyncedAt: string | null;

  @ApiProperty()
  openFailureCount: number;

  @ApiProperty({
    description: 'Draft projects created from Closed Won deals',
  })
  provisionedProjectCount: number;

  @ApiProperty({
    description: 'Unresolved Closed Won charter provisioning failures',
  })
  openProvisionFailureCount: number;

  @ApiProperty({ type: [ZohoProvisionErrorDto] })
  recentProvisionErrors: ZohoProvisionErrorDto[];
}

export class ZohoTestResultDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty()
  message: string;
}

export class ZohoOpportunitySyncResultDto {
  @ApiProperty()
  fetched: number;

  @ApiProperty()
  upserted: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  provisioned: number;

  @ApiProperty()
  provisionSkipped: number;

  @ApiProperty()
  provisionFailed: number;
}

export class ZohoOpportunityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  zohoOpportunityId: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  accountName: string | null;

  @ApiPropertyOptional({ nullable: true })
  expectedRevenue: string | null;

  @ApiPropertyOptional({ nullable: true })
  stage: string | null;

  @ApiProperty()
  syncedAt: string;
}

export class ZohoBooksStatusDto {
  @ApiProperty()
  configured: boolean;

  @ApiProperty()
  booksConfigured: boolean;

  @ApiPropertyOptional({ nullable: true })
  organizationId: string | null;

  @ApiProperty()
  invoiceCount: number;

  @ApiPropertyOptional({ nullable: true })
  lastSyncedAt: string | null;

  @ApiProperty()
  openFailureCount: number;

  @ApiProperty()
  unmatchedOpenCount: number;

  @ApiProperty({ type: [ZohoProvisionErrorDto] })
  recentErrors: ZohoProvisionErrorDto[];
}

export class ZohoInvoiceSyncResultDto {
  @ApiProperty()
  fetched: number;

  @ApiProperty()
  upserted: number;

  @ApiProperty()
  unmatched: number;

  @ApiProperty()
  failed: number;
}

export class PaymentDelayAlertResultDto {
  @ApiProperty()
  scanned: number;

  @ApiProperty()
  notified: number;

  @ApiProperty()
  skipped: number;
}

export class DiscrepancyAlertResultDto {
  @ApiProperty()
  scanned: number;

  @ApiProperty()
  mismatched: number;

  @ApiProperty()
  cleared: number;

  @ApiProperty()
  notified: number;

  @ApiProperty()
  skipped: number;
}

export class ZohoInvoiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  zohoInvoiceId: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiPropertyOptional({ nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenceNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null;

  @ApiPropertyOptional({ nullable: true })
  projectName: string | null;

  @ApiProperty()
  amount: string;

  @ApiPropertyOptional({ nullable: true })
  balance: string | null;

  @ApiPropertyOptional({ nullable: true })
  paymentMade: string | null;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  invoiceDate: string | null;

  @ApiProperty()
  dueDate: string;

  @ApiPropertyOptional({ nullable: true })
  collectionDate: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  syncedAt: string;

  @ApiPropertyOptional({ nullable: true })
  matchedMilestoneId: string | null;

  @ApiPropertyOptional({ nullable: true })
  milestoneTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  discrepancyNote: string | null;
}

export class LinkZohoInvoiceDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Project UUID to link, or null to unlink',
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  projectId: string | null;
}

export class LinkZohoInvoiceMilestoneDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Milestone UUID on the invoice project, or null to unlink',
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  milestoneId: string | null;
}

export class ZohoFailedSyncRecordDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  integration: string;

  @ApiProperty()
  entityType: string;

  @ApiPropertyOptional({ nullable: true })
  entityId: string | null;

  @ApiProperty()
  direction: string;

  @ApiProperty()
  errorMsg: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  failureClass: string;

  @ApiPropertyOptional({ nullable: true })
  deadLetteredAt: string | null;

  @ApiProperty()
  isDeadLetter: boolean;

  @ApiProperty()
  isResolved: boolean;

  @ApiProperty()
  lastAttempted: string;

  @ApiProperty()
  createdAt: string;
}

export class ZohoFailedSyncRecordListDto {
  @ApiProperty({ type: [ZohoFailedSyncRecordDto] })
  data: ZohoFailedSyncRecordDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  unresolvedCount: number;
}

export class RetryZohoSyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  failedSyncRecordId?: string;
}

export class RetryZohoSyncResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
