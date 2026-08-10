import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportEnqueueResultDto {
  @ApiProperty({ enum: ['started', 'queued'] })
  status: 'started' | 'queued';

  @ApiPropertyOptional({
    description: 'Bull job id when status is started',
    nullable: true,
  })
  jobId?: string | null;

  @ApiPropertyOptional({
    description: '1-based position in the pending queue (next to run = 1)',
  })
  position?: number;

  @ApiPropertyOptional({
    description: 'Number of pending (waiting) imports for this user',
  })
  pendingCount?: number;

  @ApiPropertyOptional({
    description: 'Active + pending count after this enqueue',
  })
  totalCount?: number;

  @ApiPropertyOptional({
    description: 'Max slots per user (active + pending)',
  })
  maxPerUser?: number;

  @ApiPropertyOptional({
    description: 'Currently running/waiting Bull job id, if any',
    nullable: true,
  })
  activeJobId?: string | null;

  @ApiPropertyOptional({
    description: 'Client id to poll until this queued import starts',
    nullable: true,
  })
  queueId?: string | null;
}

export class QueuedImportStatusDto {
  @ApiProperty({ enum: ['queued', 'started', 'unknown'] })
  status: 'queued' | 'started' | 'unknown';

  @ApiPropertyOptional({ nullable: true })
  jobId?: string | null;

  @ApiPropertyOptional()
  position?: number;

  @ApiPropertyOptional()
  pendingCount?: number;

  @ApiPropertyOptional()
  maxPerUser?: number;
}

export class ImportJobStatusDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({
    enum: [
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
      'unknown',
    ],
  })
  status:
    | 'waiting'
    | 'active'
    | 'completed'
    | 'failed'
    | 'delayed'
    | 'paused'
    | 'unknown';

  @ApiProperty({ description: '0–100 percent complete' })
  progress: number;

  @ApiPropertyOptional({ nullable: true })
  step: string | null;

  @ApiPropertyOptional({ nullable: true })
  kind: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  result: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  failedReason: string | null;
}

export class ActiveImportJobDto {
  @ApiPropertyOptional({ nullable: true })
  jobId: string | null;

  @ApiPropertyOptional({ nullable: true })
  kind: string | null;

  @ApiPropertyOptional({
    enum: ['waiting', 'active', 'delayed', 'paused', null],
    nullable: true,
  })
  status: 'waiting' | 'active' | 'delayed' | 'paused' | null;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional({ nullable: true })
  step: string | null;

  @ApiPropertyOptional({
    description: 'Pending imports waiting behind the active one',
  })
  queuedCount?: number;

  @ApiPropertyOptional({
    description: 'Max slots per user (active + pending)',
  })
  maxPerUser?: number;
}
