import { ApiProperty } from '@nestjs/swagger';
import type { SearchCategory } from './query-global-search.dto';

export const SEARCH_RESULT_TYPES = [
  'project',
  'task',
  'user',
  'audit',
  'app',
] as const;

export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

export class GlobalSearchItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SEARCH_RESULT_TYPES })
  type: SearchResultType;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  subtitle?: string;

  @ApiProperty({ description: 'Frontend route path (without locale prefix)' })
  href: string;

  @ApiProperty({ required: false })
  updatedAt?: string;

  @ApiProperty({ example: 'Projects' })
  category: string;
}

export class GlobalSearchResponseDto {
  @ApiProperty({ type: [GlobalSearchItemDto] })
  items: GlobalSearchItemDto[];

  @ApiProperty({
    description: 'Categories the current user may search',
    enum: ['all', 'tasks', 'projects', 'people', 'audit', 'apps'],
    isArray: true,
  })
  availableCategories: SearchCategory[];

  @ApiProperty({
    description: 'Result counts per category for the active query',
    example: { projects: 3, tasks: 5 },
  })
  facets: Partial<Record<Exclude<SearchCategory, 'all'>, number>>;
}
