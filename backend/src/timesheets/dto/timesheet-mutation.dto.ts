import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
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

  @ApiProperty({ example: 4.5 })
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours: number;

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
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours?: number;

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

export class SubmitTimesheetWeekDto {
  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  weekStart: string;
}
