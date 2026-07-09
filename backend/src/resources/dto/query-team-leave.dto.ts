import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const TEAM_LEAVE_SORT_FIELDS = [
  'employeeName',
  'department',
  'type',
  'from',
  'days',
  'status',
] as const;

export type TeamLeaveSortField = (typeof TEAM_LEAVE_SORT_FIELDS)[number];

export class QueryTeamLeaveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TEAM_LEAVE_SORT_FIELDS })
  @IsOptional()
  @IsIn([...TEAM_LEAVE_SORT_FIELDS])
  sortBy?: TeamLeaveSortField;

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
