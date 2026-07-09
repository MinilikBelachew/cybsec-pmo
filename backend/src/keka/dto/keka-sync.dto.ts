import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KekaSyncJobResultDto {
  @ApiProperty()
  entityType: string;

  @ApiProperty()
  synced: number;

  @ApiProperty()
  failed: number;
}

export class KekaSyncRunResultDto {
  @ApiProperty()
  startedAt: string;

  @ApiProperty()
  completedAt: string;

  @ApiProperty({ type: [KekaSyncJobResultDto] })
  results: KekaSyncJobResultDto[];
}

export class KekaSyncEnqueueResultDto {
  @ApiProperty()
  jobId: string | number;
}

export class KekaSyncLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  direction: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  errorMsg?: string | null;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  createdAt: Date;
}
