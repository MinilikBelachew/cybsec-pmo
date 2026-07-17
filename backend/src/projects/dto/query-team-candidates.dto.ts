import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryTeamCandidatesDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Project owning department. When department staffing is set to block, candidates are limited to employees allowed for this department (same-department or allow-list including the project department). When set to warn, all employees are returned and departmentStaffingAllowed flags mismatches. Used on create-project before a projectId exists.',
  })
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
