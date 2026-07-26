import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const EMPLOYEE_ATTENDANCE_SORT_FIELDS = [
  'attendanceDate',
  'dayType',
  'shiftStartTime',
  'shiftDuration',
  'shiftEffectiveDuration',
  'totalEffectiveHours',
  'syncedAt',
] as const;

export type EmployeeAttendanceSortField =
  (typeof EMPLOYEE_ATTENDANCE_SORT_FIELDS)[number];

/** Keka day types: 0 Working, 1 Holiday, 2 WeeklyOff, 3 Leave, 4 Unknown */
export const ATTENDANCE_DAY_TYPES = [0, 1, 2, 3, 4] as const;

export class QueryEmployeeAttendanceDto {
  @ApiPropertyOptional({
    description: 'Free-text search (date YYYY-MM-DD, or day type keyword)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by Keka day type (0–4). Omit for all.',
    enum: ATTENDANCE_DAY_TYPES,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...ATTENDANCE_DAY_TYPES])
  dayType?: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_ATTENDANCE_SORT_FIELDS })
  @IsOptional()
  @IsIn([...EMPLOYEE_ATTENDANCE_SORT_FIELDS])
  sortBy?: EmployeeAttendanceSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
