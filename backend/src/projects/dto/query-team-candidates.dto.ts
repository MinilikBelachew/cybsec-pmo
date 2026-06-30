import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryTeamCandidatesDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When set, marks members already on this project and excludes its hours from other-project totals when previewing.',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Planning window start — availability counts allocations overlapping this range.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Planning window end — availability counts allocations overlapping this range.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Search candidates by name, email, or designation.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
