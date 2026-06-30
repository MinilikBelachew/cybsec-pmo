import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SEARCH_CATEGORIES = [
  'all',
  'tasks',
  'projects',
  'people',
  'audit',
  'apps',
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export class QueryGlobalSearchDto {
  @ApiPropertyOptional({ example: 'website redesign' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: SEARCH_CATEGORIES, default: 'all' })
  @IsEnum(SEARCH_CATEGORIES)
  @IsOptional()
  category?: SearchCategory = 'all';

  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
