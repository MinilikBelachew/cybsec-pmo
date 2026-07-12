import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryAllocationDateIssuesDto {
  @ApiPropertyOptional({ example: '2026-07-07' })
  @IsOptional()
  @IsDateString()
  projectStartDate?: string;

  @ApiPropertyOptional({ example: '2026-07-30' })
  @IsOptional()
  @IsDateString()
  projectEndDate?: string;
}

export class AllocationDateIssueDto {
  @ApiProperty()
  allocationId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty({ type: [String] })
  kinds: string[];

  @ApiProperty({ type: [String] })
  messages: string[];
}

export class AlignAllocationPreviewRowDto {
  @ApiProperty()
  allocationId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  currentStartDate: string;

  @ApiPropertyOptional({ nullable: true })
  currentEndDate: string | null;

  @ApiProperty()
  proposedStartDate: string;

  @ApiPropertyOptional({ nullable: true })
  proposedEndDate: string | null;
}

export class AllocationDateIssuesResponseDto {
  @ApiProperty()
  projectStartDate: string;

  @ApiProperty()
  projectEndDate: string;

  @ApiProperty({ type: [AllocationDateIssueDto] })
  issues: AllocationDateIssueDto[];

  @ApiProperty({ type: [AlignAllocationPreviewRowDto] })
  alignPreview: AlignAllocationPreviewRowDto[];

  @ApiProperty()
  hasIssues: boolean;

  @ApiProperty()
  canAlign: boolean;
}

export class AlignProjectAllocationsResultDto {
  @ApiProperty()
  updatedCount: number;

  @ApiProperty({ type: [String] })
  warnings: string[];
}
