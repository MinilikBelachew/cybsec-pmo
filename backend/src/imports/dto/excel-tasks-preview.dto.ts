import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PreviewExcelTasksDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;
}

class ExcelTaskPreviewPredecessorDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  lagDays?: number;
}

export class ExcelTaskPreviewRowDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  priority!: string;

  @ApiProperty()
  @IsString()
  status!: string;

  @ApiProperty()
  @IsString()
  assigneeName!: string;

  @ApiProperty()
  @IsString()
  phaseName!: string;

  @ApiProperty()
  @IsString()
  startDate!: string;

  @ApiProperty()
  @IsString()
  endDate!: string;

  @ApiProperty()
  @IsNumber()
  effortHours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baselineStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baselineEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baselineDurationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressApproved?: number;

  @ApiPropertyOptional({ type: [ExcelTaskPreviewPredecessorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelTaskPreviewPredecessorDto)
  predecessors?: ExcelTaskPreviewPredecessorDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  resolvedAssigneeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  resolvedPhaseId?: string | null;

  @ApiProperty({ enum: ['create', 'update'] })
  @IsEnum(['create', 'update'])
  importMode!: 'create' | 'update';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedTaskId?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  errors!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  warnings!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  isSummary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  isMilestone?: boolean;
}

export class ExcelTasksPreviewCountsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  valid!: number;

  @ApiProperty()
  invalid!: number;

  @ApiProperty()
  create!: number;

  @ApiProperty()
  update!: number;
}

export class ExcelTasksPreviewExistingTaskDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title!: string;
}

export class ExcelTasksPreviewResultDto {
  @ApiProperty()
  previewId!: string;

  @ApiProperty({ type: [ExcelTaskPreviewRowDto] })
  rows!: ExcelTaskPreviewRowDto[];

  @ApiProperty({ type: ExcelTasksPreviewCountsDto })
  counts!: ExcelTasksPreviewCountsDto;

  @ApiProperty({ type: [ExcelTasksPreviewExistingTaskDto] })
  existingTasks!: ExcelTasksPreviewExistingTaskDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasMore!: boolean;
}

export class ExcelTasksPreviewPageQueryDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class PatchExcelTasksPreviewRowDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @ApiProperty({ type: Object })
  @IsObject()
  patch!: Record<string, unknown>;
}

export class ConfirmExcelTasksPreviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  previewId!: string;
}
