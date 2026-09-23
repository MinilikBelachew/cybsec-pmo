import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ExcelPredecessorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  predecessorTitle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  lagDays?: number;
}

export class ExcelTaskImportRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  effortHours?: number;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  resolvedAssigneeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  resolvedPhaseId?: string | null;

  @ApiPropertyOptional({
    description: 'Phase name from Excel. Used when resolvedPhaseId is not set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phaseName?: string;

  @ApiProperty({ enum: ['create', 'update'] })
  @IsEnum(['create', 'update'])
  importMode: 'create' | 'update';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedTaskId?: string;

  @ApiPropertyOptional({ type: [ExcelPredecessorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelPredecessorDto)
  predecessors?: ExcelPredecessorDto[];

  @ApiPropertyOptional({
    description:
      'Parent task title from Excel. Empty string clears the parent; omit to leave unchanged.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentTaskTitle?: string;
}

export class ExcelTasksImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ type: [ExcelTaskImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50000)
  @ValidateNested({ each: true })
  @Type(() => ExcelTaskImportRowDto)
  rows: ExcelTaskImportRowDto[];
}
