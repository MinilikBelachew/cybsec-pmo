import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MppImportPreviewTaskDto {
  @ApiProperty()
  uid: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  finishDate?: string;

  @ApiPropertyOptional()
  durationDays?: number;

  @ApiPropertyOptional()
  baselineStartDate?: string;

  @ApiPropertyOptional()
  baselineFinishDate?: string;

  @ApiPropertyOptional()
  baselineDurationDays?: number;

  @ApiPropertyOptional()
  actualStartDate?: string;

  @ApiPropertyOptional()
  actualFinishDate?: string;

  @ApiPropertyOptional()
  percentComplete?: number;

  @ApiPropertyOptional()
  phaseName?: string;

  @ApiProperty()
  hasParent: boolean;

  @ApiProperty()
  predecessorCount: number;
}

export class MppImportPreviewMilestoneDto {
  @ApiProperty()
  uid: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  targetDate?: string;

  @ApiPropertyOptional()
  phaseName?: string;

  @ApiPropertyOptional()
  percentComplete?: number;

  @ApiProperty()
  status: string;
}

export class MppImportPreviewProjectDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  finishDate?: string;

  @ApiPropertyOptional()
  baselineStartDate?: string;

  @ApiPropertyOptional()
  baselineFinishDate?: string;

  @ApiPropertyOptional()
  durationDays?: number;

  @ApiPropertyOptional()
  baselineDurationDays?: number;

  @ApiPropertyOptional()
  percentComplete?: number;

  @ApiPropertyOptional()
  durationVarianceDays?: number;

  @ApiPropertyOptional({
    description: 'Project-level Cost from the file. Used as Cybsec value on create.',
  })
  cost?: number;

  @ApiProperty()
  taskCount: number;

  @ApiProperty()
  phaseCount: number;

  @ApiProperty()
  milestoneCount: number;

  @ApiProperty()
  dependencyCount: number;

  @ApiProperty({ enum: ['create', 'update'] })
  importMode: 'create' | 'update';

  @ApiPropertyOptional({ format: 'uuid' })
  resolvedProjectId?: string;

  @ApiProperty({ type: [MppImportPreviewTaskDto] })
  tasks: MppImportPreviewTaskDto[];

  @ApiProperty({ type: [MppImportPreviewMilestoneDto] })
  milestones: MppImportPreviewMilestoneDto[];
}

export class MppImportPreviewCountsDto {
  @ApiProperty()
  importableTasks: number;

  @ApiProperty({
    description: 'Top-level MS Project summary rows that will become phases',
  })
  phasesFromSummaries: number;

  @ApiProperty({
    description: 'MS Project milestone rows that will become project milestones',
  })
  milestonesFromFile: number;

  @ApiProperty({
    description: 'Nested summary rows (now imported as parent tasks; kept for API compatibility)',
    example: 0,
  })
  skippedSummaryTasks: number;

  @ApiProperty()
  dependencies: number;

  @ApiProperty()
  resourcesMatched: number;

  @ApiProperty()
  resourcesUnmatched: number;

  @ApiPropertyOptional({
    description: 'Number of L1 projects in a portfolio file',
  })
  projects?: number;
}

export class MppImportPreviewDto {
  @ApiProperty({ enum: ['single', 'portfolio'] })
  mode: 'single' | 'portfolio';

  @ApiPropertyOptional()
  projectName?: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  finishDate?: string;

  @ApiPropertyOptional({
    description: 'Project-level Cost from the file. Used as Cybsec value on create.',
  })
  cost?: number;

  @ApiPropertyOptional({ enum: ['create', 'update'] })
  importMode?: 'create' | 'update';

  @ApiPropertyOptional({ format: 'uuid' })
  resolvedProjectId?: string;

  @ApiProperty({ type: MppImportPreviewCountsDto })
  counts: MppImportPreviewCountsDto;

  @ApiPropertyOptional({ type: [MppImportPreviewProjectDto] })
  projects?: MppImportPreviewProjectDto[];

  @ApiProperty({ type: [MppImportPreviewTaskDto] })
  tasks: MppImportPreviewTaskDto[];

  @ApiProperty({ type: [MppImportPreviewMilestoneDto] })
  milestones: MppImportPreviewMilestoneDto[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}
