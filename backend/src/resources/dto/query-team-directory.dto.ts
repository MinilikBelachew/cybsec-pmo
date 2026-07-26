import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const TEAM_DIRECTORY_SORT_FIELDS = [
  'name',
  'designation',
  'department',
  'utilization',
  'allocatedHours',
  'remainingHours',
] as const;

export type TeamDirectorySortField = (typeof TEAM_DIRECTORY_SORT_FIELDS)[number];

export const UTILIZATION_STATUS_FILTERS = [
  'all',
  'over',
  'optimal',
  'under',
  'available',
] as const;

export class QueryTeamDirectoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UTILIZATION_STATUS_FILTERS })
  @IsOptional()
  @IsIn([...UTILIZATION_STATUS_FILTERS])
  utilizationStatus?: (typeof UTILIZATION_STATUS_FILTERS)[number];

  @ApiPropertyOptional({ enum: TEAM_DIRECTORY_SORT_FIELDS })
  @IsOptional()
  @IsIn([...TEAM_DIRECTORY_SORT_FIELDS])
  sortBy?: TeamDirectorySortField;

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
  @Max(100)
  limit?: number;
}
