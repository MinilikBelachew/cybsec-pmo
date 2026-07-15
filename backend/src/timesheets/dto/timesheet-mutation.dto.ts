import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTimesheetEntryDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsUUID()
  taskId: string;

  @ApiProperty({ example: '2026-07-04' })
  @IsDateString()
  workDate: string;

  @ApiPropertyOptional({
    example: 4.5,
    description:
      'Legacy total hours. Used when regularHours/overtimeHours are omitted — all hours stored as regular.',
  })
  @ValidateIf(
    (dto: CreateTimesheetEntryDto) =>
      dto.regularHours === undefined && dto.overtimeHours === undefined,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional({ example: 4, description: 'Regular (non-OT) hours' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  regularHours?: number;

  @ApiPropertyOptional({ example: 1, description: 'Overtime hours' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class UpdateTimesheetEntryDto {
  @ApiPropertyOptional({
    description:
      'Legacy total hours. Used when regularHours/overtimeHours are omitted — all hours stored as regular.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional({ description: 'Regular (non-OT) hours' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  regularHours?: number;

  @ApiPropertyOptional({ description: 'Overtime hours' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class QueryTimesheetWeekDto {
  @ApiPropertyOptional({
    description: 'Monday of the week (YYYY-MM-DD). Defaults to current week.',
  })
  @IsOptional()
  @IsDateString()
  weekStart?: string;
}

export class QueryTimesheetContextDto {
  @ApiPropertyOptional({
    description:
      'Date (YYYY-MM-DD) used to resolve active allocations. Defaults to today.',
    example: '2026-07-14',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class SubmitTimesheetWeekDto {
  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  weekStart: string;
}
