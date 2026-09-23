import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
