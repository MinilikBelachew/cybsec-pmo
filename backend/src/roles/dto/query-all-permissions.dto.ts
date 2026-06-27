import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ALL_PERMISSION_SORT_FIELDS = [
  'module',
  'action',
  'recordScope',
  'roleCode',
  'roleLabel',
] as const;

export type AllPermissionSortField = (typeof ALL_PERMISSION_SORT_FIELDS)[number];

export class QueryAllPermissionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by role id' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  roleId?: number;

  @ApiPropertyOptional({
    description: 'Search module, action, record scope, or role',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ALL_PERMISSION_SORT_FIELDS, default: 'module' })
  @IsOptional()
  @IsIn(ALL_PERMISSION_SORT_FIELDS)
  sortBy?: AllPermissionSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
