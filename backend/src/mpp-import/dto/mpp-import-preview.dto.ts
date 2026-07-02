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
  percentComplete?: number;

  @ApiProperty()
  hasParent: boolean;

  @ApiProperty()
  predecessorCount: number;
}

export class MppImportPreviewCountsDto {
  @ApiProperty()
  importableTasks: number;

  @ApiProperty()
  skippedSummaryTasks: number;

  @ApiProperty()
  dependencies: number;

  @ApiProperty()
  resourcesMatched: number;

  @ApiProperty()
  resourcesUnmatched: number;
}

export class MppImportPreviewDto {
  @ApiPropertyOptional()
  projectName?: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  finishDate?: string;

  @ApiProperty({ type: MppImportPreviewCountsDto })
  counts: MppImportPreviewCountsDto;

  @ApiProperty({ type: [MppImportPreviewTaskDto] })
  tasks: MppImportPreviewTaskDto[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}
