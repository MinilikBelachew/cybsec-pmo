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

export class KekaSyncJobCountsDto {
  @ApiProperty()
  synced: number;

  @ApiProperty()
  failed: number;
}

export class KekaSyncJobStatusDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'unknown'],
  })
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'unknown';

  @ApiProperty({ description: '0–100 percent complete' })
  progress: number;

  @ApiPropertyOptional({ nullable: true })
  step: string | null;

  @ApiPropertyOptional({ type: KekaSyncJobCountsDto, nullable: true })
  result: KekaSyncJobCountsDto | null;

  @ApiPropertyOptional({ nullable: true })
  failedReason: string | null;
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
