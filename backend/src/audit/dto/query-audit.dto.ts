import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export const AUDIT_SORT_FIELDS = [
  'createdAt',
  'action',
  'objectType',
  'breakGlassAction',
] as const;

export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

export class QueryAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'When true, return only actions performed during break-glass sessions',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  breakGlassOnly?: boolean;

  @ApiPropertyOptional({
    description: 'When true, return only actions performed by external users',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  externalOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by actor user UUID' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start date (YYYY-MM-DD)',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date (YYYY-MM-DD)',
    example: '2026-06-15',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search action, object type, actor email/name, or IP address',
  })
  @IsOptional()
  @IsString()
  @Max(200)
  search?: string;

  @ApiPropertyOptional({ enum: AUDIT_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(AUDIT_SORT_FIELDS)
  sortBy?: AuditSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    enum: ['json', 'xlsx', 'pdf'],
    default: 'json',
    description: 'Export file format (export endpoint only)',
  })
  @IsOptional()
  @IsIn(['json', 'xlsx', 'pdf'])
  format?: 'json' | 'xlsx' | 'pdf';
}
